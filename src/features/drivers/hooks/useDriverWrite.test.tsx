import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../api/instance";
import type { Driver } from "../../../api/types";
import { ApiError } from "../../../errors/types";
import { ToastProvider } from "../../../ui/Toast";
import { useDriverWrite, type DriverCreateOutcome } from "./useDriverWrite";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../../api/hooks/drivers", () => ({
  useCreateDriver: () => ({ mutateAsync: mocks.create }),
  useUpdateDriver: () => ({ mutateAsync: mocks.update }),
}));

const driver: Driver = {
  id: "driver-1",
  name: "Adebayo Okafor",
  phone: "08031000010",
  licence: "LIC-01010",
  status: "active",
  vehicles: 1,
};

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  };
}

function setup() {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
  const { result } = renderHook(() => useDriverWrite(), { wrapper: wrapperFor(queryClient) });
  return { queryClient, invalidate, result };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDriverWrite", () => {
  it("creates a driver and reports success", async () => {
    mocks.create.mockResolvedValue({ id: "driver-2" });
    const { result } = setup();

    const outcome = await act(() =>
      result.current.create({ name: "Ada Obi" }, new Set(["driver-1"])),
    );
    expect(outcome).toEqual({ status: "created" });
    expect(mocks.create).toHaveBeenCalledWith({
      input: { name: "Ada Obi" },
      signal: expect.any(AbortSignal),
    });
  });

  it("reconciles an unknown create outcome and refreshes the list", async () => {
    mocks.create.mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(api, "drivers").mockResolvedValue({
      data: [
        driver,
        { ...driver, id: "driver-2", name: "Ada Obi", phone: "", licence: "", vehicles: 0 },
      ],
    });
    const { result, invalidate } = setup();

    const outcome = await act(() =>
      result.current.create({ name: "Ada Obi" }, new Set(["driver-1"])),
    );
    expect(outcome).toEqual({ status: "reconciled" });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["drivers"]);
  });

  it("blocks a double submit", async () => {
    let finish: (value: { id: string }) => void = () => undefined;
    mocks.create.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = setup();

    const first = result.current.create({ name: "Ada Obi" }, new Set());
    const second = await result.current.create({ name: "Ada Obi" }, new Set());
    expect(second).toEqual({ status: "ignored" });

    await act(async () => {
      finish({ id: "driver-2" });
      await first;
    });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("updates a driver with a field diff", async () => {
    mocks.update.mockResolvedValue(undefined);
    const { result } = setup();

    const outcome = await act(() => result.current.update(driver, { phone: "" }));
    expect(outcome).toEqual({ status: "done", reconciled: false });
    expect(mocks.update).toHaveBeenCalledWith({
      id: driver.id,
      update: { phone: "" },
      signal: expect.any(AbortSignal),
    });
  });

  it("refreshes every denormalised root after a reconciled update", async () => {
    mocks.update.mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(api, "drivers").mockResolvedValue({ data: [{ ...driver, status: "inactive" }] });
    const { result, invalidate } = setup();

    const outcome = await act(() => result.current.update(driver, { status: "inactive" }));
    expect(outcome).toEqual({ status: "done", reconciled: true });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["drivers"]);
    expect(keys).toContainEqual(["live-snapshot"]);
    expect(keys).toContainEqual(["vehicle"]);
    expect(keys).toContainEqual(["vehicles"]);
    expect(keys).toContainEqual(["trips"]);
  });

  it("reports a gone driver and refreshes the list", async () => {
    mocks.update.mockRejectedValue(new ApiError(404, "not_found", "driver not found"));
    const { result, invalidate } = setup();

    const outcome = await act(() => result.current.update(driver, { phone: "" }));
    expect(outcome).toEqual({ status: "gone" });
    expect(invalidate).toHaveBeenCalled();
    expect(result.current.error?.kind).toBe("not_found");
  });

  it("returns the error for a failed update", async () => {
    mocks.update.mockRejectedValue(
      new ApiError(400, "invalid_status", "status must be active or inactive"),
    );
    const { result } = setup();

    const outcome = await act(() => result.current.update(driver, { status: "inactive" }));
    expect(outcome.status).toBe("error");
    if (outcome.status === "error") {
      expect(outcome.error.kind).toBe("validation");
      expect(outcome.error.code).toBe("invalid_status");
    }
  });

  it("cancels a slow create and reconciles what the server did", async () => {
    mocks.create.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    vi.spyOn(api, "drivers").mockResolvedValue({
      data: [
        driver,
        { ...driver, id: "driver-2", name: "Ada Obi", phone: "", licence: "", vehicles: 0 },
      ],
    });
    const { result } = setup();

    let outcome: DriverCreateOutcome | undefined;
    await act(async () => {
      const pending = result.current.create({ name: "Ada Obi" }, new Set(["driver-1"]));
      result.current.cancel();
      outcome = await pending;
    });

    expect(outcome).toEqual({ status: "reconciled" });
  });

  it("retries a cancelled create only when it did not reach the server", async () => {
    const abortable = ({ signal }: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    mocks.create.mockImplementationOnce(abortable).mockResolvedValueOnce({ id: "driver-2" });
    vi.spyOn(api, "drivers").mockResolvedValue({ data: [driver] });
    const { result } = setup();

    let outcome: DriverCreateOutcome | undefined;
    await act(async () => {
      const pending = result.current.create({ name: "Ada Obi" }, new Set(["driver-1"]));
      result.current.retry();
      outcome = await pending;
    });

    expect(outcome).toEqual({ status: "created" });
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
});

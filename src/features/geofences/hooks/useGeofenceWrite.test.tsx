import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../api/instance";
import type { Geofence, GeofenceInput } from "../../../api/types";
import { ApiError } from "../../../errors/types";
import { ToastProvider } from "../../../ui/Toast";
import { useGeofenceWrite } from "./useGeofenceWrite";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../../api/hooks/geofences", () => ({
  useCreateGeofence: () => ({ mutateAsync: mocks.create }),
  useUpdateGeofence: () => ({ mutateAsync: mocks.update }),
}));

const geofence: Geofence = {
  id: "gf-1",
  name: "Lekki Depot",
  kind: "depot",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [3.47, 6.43],
        [3.49, 6.43],
        [3.49, 6.445],
        [3.47, 6.43],
      ],
    ],
  },
};

const input: GeofenceInput = {
  name: "Refinery Gate",
  kind: "restricted",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [3.38, 6.44],
        [3.4, 6.44],
        [3.4, 6.455],
        [3.38, 6.44],
      ],
    ],
  },
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
  const { result } = renderHook(() => useGeofenceWrite(), {
    wrapper: wrapperFor(queryClient),
  });
  return { invalidate, result };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useGeofenceWrite", () => {
  it("creates a geofence and returns its id", async () => {
    mocks.create.mockResolvedValue({ id: "gf-2" });
    const { result } = setup();

    const outcome = await act(() =>
      result.current.create(input, new Set(["gf-1"])),
    );
    expect(outcome).toEqual({ status: "created", id: "gf-2" });
    expect(mocks.create).toHaveBeenCalledWith({
      input,
      signal: expect.any(AbortSignal),
    });
  });

  it("reconciles an unknown create and returns the matched id", async () => {
    mocks.create.mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(api, "geofences").mockResolvedValue({
      data: [
        geofence,
        { id: "gf-2", name: input.name, kind: "restricted", geometry: input.geometry },
      ],
    });
    const { result, invalidate } = setup();

    const outcome = await act(() =>
      result.current.create(input, new Set(["gf-1"])),
    );
    expect(outcome).toEqual({ status: "reconciled", id: "gf-2" });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["geofences"]);
  });

  it("blocks a double submit", async () => {
    let finish: (value: { id: string }) => void = () => undefined;
    mocks.create.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = setup();

    const first = result.current.create(input, new Set());
    const second = await result.current.create(input, new Set());
    expect(second).toEqual({ status: "ignored" });
    await act(async () => {
      finish({ id: "gf-2" });
      await first;
    });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("updates with a field diff", async () => {
    mocks.update.mockResolvedValue(undefined);
    const { result } = setup();

    const outcome = await act(() => result.current.update(geofence, { name: "Lekki Gate" }));
    expect(outcome).toEqual({ status: "done", reconciled: false });
    expect(mocks.update).toHaveBeenCalledWith({
      id: "gf-1",
      update: { name: "Lekki Gate" },
      signal: expect.any(AbortSignal),
    });
  });

  it("reconciles an unknown update by comparing the intended fields", async () => {
    mocks.update.mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(api, "geofences").mockResolvedValue({
      data: [{ ...geofence, name: "Lekki Gate" }],
    });
    const { result } = setup();

    const outcome = await act(() => result.current.update(geofence, { name: "Lekki Gate" }));
    expect(outcome).toEqual({ status: "done", reconciled: true });
  });

  it("reports a gone geofence and refreshes the list", async () => {
    mocks.update.mockRejectedValue(new ApiError(404, "not_found", "geofence not found"));
    const { result, invalidate } = setup();

    const outcome = await act(() => result.current.update(geofence, { name: "Lekki Gate" }));
    expect(outcome).toEqual({ status: "gone" });
    expect(invalidate).toHaveBeenCalled();
  });

  it("surfaces a validation error from the server", async () => {
    mocks.create.mockRejectedValue(
      new ApiError(400, "invalid_geometry", "geometry must be a valid polygon"),
    );
    const { result } = setup();

    const outcome = await act(() => result.current.create(input, new Set()));
    expect(outcome.status).toBe("error");
    if (outcome.status === "error") {
      expect(outcome.error.code).toBe("invalid_geometry");
    }
  });
});

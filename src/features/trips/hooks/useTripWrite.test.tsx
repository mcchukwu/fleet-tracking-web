import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../api/instance";
import type { Trip } from "../../../api/types";
import { ToastProvider } from "../../../ui/Toast";
import { useTripWrite } from "./useTripWrite";

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    vehicle_id: "vehicle-1",
    plate: "LSD-100-AA",
    origin: "Refinery Gate",
    destination: "Ibadan Customer",
    status: "planned",
    distance_km: 0,
    ...overrides,
  };
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  };
}

function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const input = {
  vehicle_id: "vehicle-1",
  origin: "Refinery Gate",
  destination: "Ibadan Customer",
};

describe("useTripWrite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a trip, invalidates the trips root and toasts", async () => {
    const create = vi.spyOn(api, "createTrip").mockResolvedValue({ id: "trip-2" });
    const queryClient = newClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useTripWrite(), {
      wrapper: wrapperFor(queryClient),
    });

    const outcome = await result.current.create(input, new Set());
    expect(create).toHaveBeenCalledWith(input);
    expect(outcome).toEqual({ status: "created" });
    expect(await screen.findByText("Trip created.")).toBeVisible();
    expect(invalidate.mock.calls.some(([options]) => options?.queryKey?.[0] === "trips")).toBe(
      true,
    );
  });

  it("ignores a second submit while the first is in flight", async () => {
    let resolve: ((value: { id: string }) => void) | undefined;
    vi.spyOn(api, "createTrip").mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = renderHook(() => useTripWrite(), {
      wrapper: wrapperFor(newClient()),
    });

    const first = result.current.create(input, new Set());
    const second = await result.current.create(input, new Set());
    expect(second).toEqual({ status: "ignored" });
    resolve?.({ id: "trip-2" });
    await expect(first).resolves.toEqual({ status: "created" });
  });

  it("reconciles an unknown create by finding the new row", async () => {
    vi.spyOn(api, "createTrip").mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(api, "trips").mockResolvedValue({
      data: [trip({ id: "trip-1" }), trip({ id: "trip-2" })],
    });
    const { result } = renderHook(() => useTripWrite(), {
      wrapper: wrapperFor(newClient()),
    });

    const outcome = await result.current.create(input, new Set(["trip-1"]));
    expect(outcome).toEqual({ status: "reconciled" });
    expect(await screen.findByText("It was saved.")).toBeVisible();
  });

  it("reports a create that was not saved", async () => {
    vi.spyOn(api, "createTrip").mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(api, "trips").mockResolvedValue({ data: [trip({ id: "trip-1" })] });
    const { result } = renderHook(() => useTripWrite(), {
      wrapper: wrapperFor(newClient()),
    });

    const outcome = await result.current.create(input, new Set(["trip-1"]));
    expect(outcome.status).toBe("error");
    if (outcome.status !== "error") return;
    expect(outcome.error.kind).toBe("network");
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("transitions with the exact payload and handles a gone trip", async () => {
    const update = vi.spyOn(api, "updateTrip").mockResolvedValue(undefined);
    const { result } = renderHook(() => useTripWrite(), {
      wrapper: wrapperFor(newClient()),
    });

    const outcome = await result.current.transition(
      trip({ status: "active" }),
      { status: "completed" },
      "complete",
    );
    expect(update).toHaveBeenCalledWith("trip-1", { status: "completed" });
    expect(outcome).toEqual({ status: "done", reconciled: false });
    expect(await screen.findByText("Trip completed.")).toBeVisible();

    const { ApiError } = await import("../../../errors/types");
    update.mockRejectedValue(new ApiError(404, "not_found", "not found"));
    vi.spyOn(api, "trips").mockResolvedValue({ data: [] });
    const gone = await result.current.transition(
      trip({ status: "active" }),
      { status: "completed" },
      "complete",
    );
    expect(gone).toEqual({ status: "gone" });
    expect(await screen.findByText(/no longer exists/)).toBeVisible();
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});

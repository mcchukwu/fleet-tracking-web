import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../api/instance";
import type { Geofence } from "../../../api/types";
import { ApiError } from "../../../errors/types";
import { ToastProvider } from "../../../ui/Toast";
import { useGeofenceDelete } from "./useGeofenceDelete";

const mocks = vi.hoisted(() => ({ remove: vi.fn() }));

vi.mock("../../../api/hooks/geofences", () => ({
  useDeleteGeofence: () => ({ mutateAsync: mocks.remove }),
}));

const geofence: Geofence = {
  id: "gf-1",
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
  const { result } = renderHook(() => useGeofenceDelete(), {
    wrapper: wrapperFor(queryClient),
  });
  return { invalidate, result };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useGeofenceDelete", () => {
  it("deletes a geofence", async () => {
    mocks.remove.mockResolvedValue(undefined);
    const { result } = setup();

    const outcome = await act(() => result.current.remove(geofence));
    expect(outcome).toEqual({ status: "deleted" });
    expect(mocks.remove).toHaveBeenCalledWith({
      id: "gf-1",
      signal: expect.any(AbortSignal),
    });
  });

  it("reconciles an unknown delete by absence", async () => {
    mocks.remove.mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(api, "geofences").mockResolvedValue({ data: [] });
    const { result, invalidate } = setup();

    const outcome = await act(() => result.current.remove(geofence));
    expect(outcome).toEqual({ status: "reconciled" });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["geofences"]);
  });

  it("does not reconcile an unknown delete when the row is still present", async () => {
    mocks.remove.mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(api, "geofences").mockResolvedValue({ data: [geofence] });
    const { result } = setup();

    const outcome = await act(() => result.current.remove(geofence));
    expect(outcome.status).toBe("error");
    if (outcome.status === "error") {
      expect(outcome.error.outcome).toBe("failed");
    }
  });

  it("returns the 409 conflict without reconciling it", async () => {
    mocks.remove.mockRejectedValue(
      new ApiError(409, "in_use", "geofence has events and cannot be deleted"),
    );
    const fetchList = vi.spyOn(api, "geofences");
    const { result } = setup();

    const outcome = await act(() => result.current.remove(geofence));
    expect(outcome.status).toBe("blocked");
    expect(fetchList).not.toHaveBeenCalled();
  });

  it("reports a gone geofence", async () => {
    mocks.remove.mockRejectedValue(new ApiError(404, "not_found", "geofence not found"));
    const { result } = setup();

    const outcome = await act(() => result.current.remove(geofence));
    expect(outcome).toEqual({ status: "gone" });
  });

  it("blocks a double submit", async () => {
    let finish: () => void = () => undefined;
    mocks.remove.mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve(undefined);
      }),
    );
    const { result } = setup();

    const first = result.current.remove(geofence);
    const second = await result.current.remove(geofence);
    expect(second).toEqual({ status: "ignored" });
    await act(async () => {
      finish();
      await first;
    });
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../instance";
import { queryKeys } from "../keys";
import { useAckAlert } from "./alerts";
import { useCreateTrip } from "./trips";

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("mutation invalidation", () => {
  it("refreshes the snapshot and health after creating a trip", async () => {
    vi.spyOn(api, "createTrip").mockResolvedValue({ id: "trip-1" });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateTrip(), { wrapper: wrapperFor(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({
        vehicle_id: "vehicle-1",
        origin: "Depot",
        destination: "Customer",
      });
    });

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["trips"]);
    expect(keys).toContainEqual(queryKeys.liveSnapshot);
    expect(keys).toContainEqual(queryKeys.systemHealth);
  });

  it("refreshes health after acknowledging an alert", async () => {
    vi.spyOn(api, "ackAlert").mockResolvedValue(undefined);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAckAlert(), { wrapper: wrapperFor(queryClient) });
    await act(async () => {
      await result.current.mutateAsync("alert-1");
    });

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["alerts"]);
    expect(keys).toContainEqual(queryKeys.systemHealth);
  });
});

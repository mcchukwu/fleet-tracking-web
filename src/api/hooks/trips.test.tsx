import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../instance";
import { useTrips, useTripsFeed } from "./trips";
import type { Trip } from "../types";

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function row(index: number): Trip {
  return {
    id: `trip-${index}`,
    vehicle_id: "vehicle-1",
    plate: "LSD-100-AA",
    origin: "Refinery Gate",
    destination: "Ibadan Customer",
    status: "planned",
    distance_km: 0,
  };
}

describe("trip feed query", () => {
  it("requests 100 rows, pages by offset and stops on a short page", async () => {
    const trips = vi.spyOn(api, "trips").mockImplementation((filters = {}) => {
      const offset = filters.offset ?? 0;
      return Promise.resolve({
        data: Array.from({ length: offset === 0 ? 100 : 5 }, (_, index) => row(offset + index)),
      });
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useTripsFeed({ status: "active" }), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(trips).toHaveBeenCalledWith(
      { status: "active", limit: 100, offset: 0 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(trips).toHaveBeenLastCalledWith(
      { status: "active", limit: 100, offset: 100 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it("stops after one short first page", async () => {
    vi.spyOn(api, "trips").mockResolvedValue({ data: [row(0)] });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useTripsFeed({}), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe("trip lookup query", () => {
  it("keeps the existing list hook for the detail lookup", async () => {
    const trips = vi.spyOn(api, "trips").mockResolvedValue({ data: [row(1)] });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useTrips({ limit: 500 }), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(trips).toHaveBeenCalledWith(
      { limit: 500 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

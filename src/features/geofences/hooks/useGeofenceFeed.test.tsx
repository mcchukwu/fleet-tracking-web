import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Geofence } from "../../../api/types";
import { useGeofenceFeed } from "./useGeofenceFeed";

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as Geofence[] | undefined,
    isPending: true,
    isLoading: true,
    isFetching: true,
    error: null as unknown,
    dataUpdatedAt: 0,
    refetch: vi.fn(),
  },
}));

vi.mock("../../../api/hooks/geofences", () => ({
  useGeofences: () => mocks.query,
}));

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const geofences: Geofence[] = [
  {
    id: "gf-1",
    name: "Lekki Depot",
    kind: "depot",
    geometry: { type: "Polygon", coordinates: [] },
  },
];

describe("useGeofenceFeed", () => {
  it("exposes the loaded list and stops loading", () => {
    mocks.query = {
      data: geofences,
      isPending: false,
      isLoading: false,
      isFetching: false,
      error: null,
      dataUpdatedAt: 1,
      refetch: vi.fn(),
    };
    const { result } = renderHook(() => useGeofenceFeed(), {
      wrapper: wrapperFor(new QueryClient()),
    });
    expect(result.current.geofences).toEqual(geofences);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.dataUpdatedAt).toBe(1);
  });

  it("passes retry through and cancels the query", async () => {
    const refetch = vi.fn().mockResolvedValue({ data: geofences });
    mocks.query = {
      data: geofences,
      isPending: false,
      isLoading: false,
      isFetching: false,
      error: null,
      dataUpdatedAt: 1,
      refetch,
    };
    const queryClient = new QueryClient();
    const cancel = vi.spyOn(queryClient, "cancelQueries").mockResolvedValue(undefined);
    const { result } = renderHook(() => useGeofenceFeed(), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current.retry();
    });
    expect(refetch).toHaveBeenCalled();

    act(() => result.current.cancel());
    expect(cancel).toHaveBeenCalledWith({ queryKey: ["geofences"] });
    expect(result.current.cancelled).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("treats an empty list as loaded", () => {
    mocks.query = {
      data: [],
      isPending: false,
      isLoading: false,
      isFetching: false,
      error: null,
      dataUpdatedAt: 1,
      refetch: vi.fn(),
    };
    const { result } = renderHook(() => useGeofenceFeed(), {
      wrapper: wrapperFor(new QueryClient()),
    });
    expect(result.current.geofences).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});

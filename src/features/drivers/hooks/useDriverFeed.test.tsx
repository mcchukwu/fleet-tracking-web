import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Driver } from "../../../api/types";
import { useDriverFeed } from "./useDriverFeed";

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as Driver[] | undefined,
    isPending: true,
    isLoading: true,
    isFetching: true,
    error: null as unknown,
    dataUpdatedAt: 0,
    refetch: vi.fn(),
  },
}));

vi.mock("../../../api/hooks/drivers", () => ({
  useDrivers: () => mocks.query,
}));

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const drivers: Driver[] = [
  {
    id: "driver-1",
    name: "Adebayo Okafor",
    phone: "08031000010",
    licence: "LIC-01010",
    status: "active",
    vehicles: 1,
  },
];

describe("useDriverFeed", () => {
  it("exposes the loaded list and stops loading", () => {
    mocks.query = {
      data: drivers,
      isPending: false,
      isLoading: false,
      isFetching: false,
      error: null,
      dataUpdatedAt: 1,
      refetch: vi.fn(),
    };
    const { result } = renderHook(() => useDriverFeed(), {
      wrapper: wrapperFor(new QueryClient()),
    });
    expect(result.current.drivers).toEqual(drivers);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.dataUpdatedAt).toBe(1);
  });

  it("passes refetch through and cancels the query", async () => {
    const refetch = vi.fn().mockResolvedValue({ data: drivers });
    mocks.query = {
      data: drivers,
      isPending: false,
      isLoading: false,
      isFetching: false,
      error: null,
      dataUpdatedAt: 1,
      refetch,
    };
    const queryClient = new QueryClient();
    const cancel = vi.spyOn(queryClient, "cancelQueries").mockResolvedValue(undefined);
    const { result } = renderHook(() => useDriverFeed(), { wrapper: wrapperFor(queryClient) });

    await act(async () => {
      await result.current.refetch();
    });
    expect(refetch).toHaveBeenCalled();

    act(() => result.current.cancel());
    expect(cancel).toHaveBeenCalledWith({ queryKey: ["drivers"] });
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
    const { result } = renderHook(() => useDriverFeed(), {
      wrapper: wrapperFor(new QueryClient()),
    });
    expect(result.current.drivers).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});

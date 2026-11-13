import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Trip } from "../../../api/types";
import { useConnectionStore } from "../../../stores/connection";
import { useTripFeed, visibleTrips } from "./useTripFeed";

const mocks = vi.hoisted(() => ({
  options: undefined as unknown,
  query: {
    data: undefined as { pages: Trip[][] } | undefined,
    isPending: false,
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    error: null as unknown,
    dataUpdatedAt: 0,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  },
}));

vi.mock("../../../api/hooks/trips", () => ({
  useTripsFeed: (_filters: unknown, options: unknown) => {
    mocks.options = options;
    return mocks.query;
  },
}));

function trip(index: number): Trip {
  return {
    id: `trip-${index}`,
    vehicle_id: `vehicle-${index}`,
    plate: `LSD-10${index}-AA`,
    origin: "Refinery Gate",
    destination: "Ibadan Customer",
    status: "planned",
    distance_km: 0,
  };
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useTripFeed", () => {
  beforeEach(() => {
    mocks.query.fetchNextPage.mockReset();
    mocks.query.refetch.mockReset();
    mocks.query.isPending = false;
    mocks.query.isLoading = false;
    mocks.query.dataUpdatedAt = 0;
    mocks.query.data = { pages: [[trip(1), trip(2)], [trip(3)]] };
    mocks.query.hasNextPage = true;
    useConnectionStore.setState({ network: "online" });
  });

  it("flattens pages and exposes paging", async () => {
    mocks.query.fetchNextPage.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTripFeed({ status: "planned" }), {
      wrapper: wrapper(new QueryClient()),
    });

    expect(result.current.trips.map((row) => row.id)).toEqual(["trip-1", "trip-2", "trip-3"]);
    expect(result.current.loadedCount).toBe(3);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    expect(mocks.query.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("passes a 15s refresh online and disables it offline", () => {
    renderHook(() => useTripFeed({}), { wrapper: wrapper(new QueryClient()) });
    expect(mocks.options).toEqual({ refetchInterval: 15_000 });

    useConnectionStore.setState({ network: "offline" });
    renderHook(() => useTripFeed({}), { wrapper: wrapper(new QueryClient()) });
    expect(mocks.options).toEqual({ refetchInterval: false });
  });

  it("cancels the feed query and marks the loading state cancelled", async () => {
    mocks.query.isPending = true;
    mocks.query.isLoading = true;
    const queryClient = new QueryClient();
    const cancel = vi.spyOn(queryClient, "cancelQueries").mockResolvedValue(undefined);
    const { result } = renderHook(() => useTripFeed({ status: "active" }), {
      wrapper: wrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(true);
    act(() => result.current.cancel());
    expect(cancel).toHaveBeenCalledWith({
      queryKey: ["trips", "feed", { status: "active" }],
    });
    await waitFor(() => expect(result.current.cancelled).toBe(true));
    expect(result.current.isLoading).toBe(false);
    mocks.query.isPending = false;
    mocks.query.isLoading = false;
  });

  it("treats a paused query as not loading", () => {
    mocks.query.isPending = true;
    mocks.query.isLoading = false;
    const { result } = renderHook(() => useTripFeed({}), {
      wrapper: wrapper(new QueryClient()),
    });

    expect(result.current.isLoading).toBe(false);
    mocks.query.isPending = false;
  });

  it("clears cancelled after a successful data update", async () => {
    mocks.query.isPending = true;
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "cancelQueries").mockResolvedValue(undefined);
    const { result, rerender } = renderHook(() => useTripFeed({ status: "active" }), {
      wrapper: wrapper(queryClient),
    });

    act(() => result.current.cancel());
    await waitFor(() => expect(result.current.cancelled).toBe(true));

    mocks.query.isPending = false;
    mocks.query.data = { pages: [[]] };
    mocks.query.dataUpdatedAt = Date.now();
    rerender();

    await waitFor(() => expect(result.current.cancelled).toBe(false));
  });

  it("does not request another page while offline", () => {
    useConnectionStore.setState({ network: "offline" });
    const { result } = renderHook(() => useTripFeed({}), {
      wrapper: wrapper(new QueryClient()),
    });

    act(() => result.current.loadMore());
    expect(mocks.query.fetchNextPage).not.toHaveBeenCalled();
  });
});

describe("visibleTrips", () => {
  it("filters and sorts without mutating the feed", () => {
    const rows = [
      trip(2),
      trip(1),
      { ...trip(3), status: "active", started_at: "2026-11-09T09:00:00Z" },
    ];
    const visible = visibleTrips(rows, "lsd101", "status");
    expect(visible.map((row) => row.id)).toEqual(["trip-1"]);
    expect(rows.map((row) => row.id)).toEqual(["trip-2", "trip-1", "trip-3"]);
  });
});

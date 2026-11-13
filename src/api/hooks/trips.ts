import {
  infiniteQueryOptions,
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";
import type { TripFilters, TripInput, TripServerFilters, TripUpdate } from "../types";

export const TRIPS_PAGE_SIZE = 100;

export function useTrips(
  filters: TripFilters = {},
  options: { enabled?: boolean; refetchInterval?: number | false } = {},
) {
  return useQuery({
    queryKey: queryKeys.trips(filters),
    queryFn: ({ signal }) => api.trips(filters, { signal }).then((response) => response.data),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
    ...(options.refetchInterval !== undefined
      ? { refetchInterval: options.refetchInterval, refetchOnWindowFocus: true }
      : {}),
    meta: { scope: "screen", resource: "trips" },
  });
}

/** Server filters are status only; search and sort are client-side over loaded pages. */
export function tripsFeedQueryOptions(filters: TripServerFilters) {
  return infiniteQueryOptions({
    queryKey: queryKeys.tripsFeed(filters),
    queryFn: ({ pageParam, signal }: { pageParam: number; signal: AbortSignal }) =>
      api
        .trips({ ...filters, limit: TRIPS_PAGE_SIZE, offset: pageParam }, { signal })
        .then((response) => response.data),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length === TRIPS_PAGE_SIZE ? lastPageParam + TRIPS_PAGE_SIZE : undefined,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    meta: { scope: "screen", resource: "trips" },
  });
}

export function useTripsFeed(
  filters: TripServerFilters,
  options: { refetchInterval?: number | false } = {},
) {
  return useInfiniteQuery({
    ...tripsFeedQueryOptions(filters),
    ...(options.refetchInterval !== undefined ? { refetchInterval: options.refetchInterval } : {}),
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TripInput) => api.createTrip(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.liveSnapshot }),
        queryClient.invalidateQueries({ queryKey: queryKeys.systemHealth }),
      ]);
    },
    meta: { scope: "screen", resource: "trips" },
  });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: TripUpdate }) => api.updateTrip(id, update),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.liveSnapshot }),
        queryClient.invalidateQueries({ queryKey: queryKeys.systemHealth }),
      ]);
    },
    meta: { scope: "screen", resource: "trips" },
  });
}

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";
import type { TripFilters, TripInput, TripUpdate } from "../types";

export function useTrips(filters: TripFilters = {}) {
  return useQuery({
    queryKey: queryKeys.trips(filters),
    queryFn: ({ signal }) => api.trips(filters, { signal }).then((response) => response.data),
    placeholderData: keepPreviousData,
    meta: { scope: "screen", resource: "trips" },
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TripInput) => api.createTrip(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    meta: { scope: "screen", resource: "trips" },
  });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: TripUpdate }) =>
      api.updateTrip(id, update),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.liveSnapshot }),
      ]);
    },
    meta: { scope: "screen", resource: "trips" },
  });
}

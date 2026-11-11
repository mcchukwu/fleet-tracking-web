import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";
import type { DriverInput, DriverUpdate } from "../types";

export interface DriverQueryOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
}

export function driversQueryOptions(options: DriverQueryOptions = {}) {
  return queryOptions({
    queryKey: queryKeys.drivers,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api.drivers({ signal }).then((response) => response.data),
    ...(options.enabled !== undefined ? { enabled: options.enabled } : {}),
    ...(options.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
    ...(options.refetchOnWindowFocus !== undefined
      ? { refetchOnWindowFocus: options.refetchOnWindowFocus }
      : {}),
    meta: { scope: "screen", resource: "drivers" },
  });
}

export function useDrivers(options: DriverQueryOptions = {}) {
  return useQuery(driversQueryOptions(options));
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DriverInput) => api.createDriver(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.drivers });
    },
    meta: { scope: "screen", resource: "drivers" },
  });
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: DriverUpdate }) =>
      api.updateDriver(id, update),
    onSuccess: async () => {
      // A rename or phone change is denormalised into snapshot vehicles and trips.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.drivers }),
        queryClient.invalidateQueries({ queryKey: queryKeys.liveSnapshot }),
        queryClient.invalidateQueries({ queryKey: ["vehicle"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
      ]);
    },
    meta: { scope: "screen", resource: "drivers" },
  });
}

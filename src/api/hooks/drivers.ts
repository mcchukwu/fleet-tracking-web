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

export interface CreateDriverVariables {
  input: DriverInput;
  signal?: AbortSignal;
}

export interface UpdateDriverVariables {
  id: string;
  update: DriverUpdate;
  signal?: AbortSignal;
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, signal }: CreateDriverVariables) =>
      api.createDriver(input, signal ? { signal } : {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.drivers });
    },
    meta: { scope: "screen", resource: "drivers" },
  });
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, update, signal }: UpdateDriverVariables) =>
      api.updateDriver(id, update, signal ? { signal } : {}),
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

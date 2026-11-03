import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";
import type { DriverInput, DriverUpdate } from "../types";

export function useDrivers() {
  return useQuery({
    queryKey: queryKeys.drivers,
    queryFn: ({ signal }) => api.drivers({ signal }).then((response) => response.data),
    meta: { scope: "screen", resource: "drivers" },
  });
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.drivers });
    },
    meta: { scope: "screen", resource: "drivers" },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";
import type { GeofenceInput } from "../types";

export function useGeofences(enabled = true) {
  return useQuery({
    queryKey: queryKeys.geofences,
    queryFn: ({ signal }) => api.geofences({ signal }).then((response) => response.data),
    enabled,
    meta: { scope: "screen", resource: "geofences" },
  });
}

export function useCreateGeofence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GeofenceInput) => api.createGeofence(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.geofences });
    },
    meta: { scope: "screen", resource: "geofences" },
  });
}

export function useUpdateGeofence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<GeofenceInput> }) =>
      api.updateGeofence(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.geofences });
    },
    meta: { scope: "screen", resource: "geofences" },
  });
}

export function useDeleteGeofence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteGeofence(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.geofences });
    },
    meta: { scope: "screen", resource: "geofences" },
  });
}

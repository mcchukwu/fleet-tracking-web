import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";
import type { GeofenceInput, GeofenceUpdate } from "../types";

export interface GeofenceQueryOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
}

export function geofencesQueryOptions(options: GeofenceQueryOptions = {}) {
  return queryOptions({
    queryKey: queryKeys.geofences,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api.geofences({ signal }).then((response) => response.data),
    ...(options.enabled !== undefined ? { enabled: options.enabled } : {}),
    ...(options.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
    ...(options.refetchOnWindowFocus !== undefined
      ? { refetchOnWindowFocus: options.refetchOnWindowFocus }
      : {}),
    meta: { scope: "screen", resource: "geofences" },
  });
}

export function useGeofences(options: GeofenceQueryOptions = {}) {
  return useQuery(geofencesQueryOptions(options));
}

export interface CreateGeofenceVariables {
  input: GeofenceInput;
  signal?: AbortSignal;
}

export interface UpdateGeofenceVariables {
  id: string;
  update: GeofenceUpdate;
  signal?: AbortSignal;
}

export interface DeleteGeofenceVariables {
  id: string;
  signal?: AbortSignal;
}

export function useCreateGeofence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, signal }: CreateGeofenceVariables) =>
      api.createGeofence(input, signal ? { signal } : {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.geofences });
    },
    meta: { scope: "screen", resource: "geofences" },
  });
}

export function useUpdateGeofence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, update, signal }: UpdateGeofenceVariables) =>
      api.updateGeofence(id, update, signal ? { signal } : {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.geofences });
    },
    meta: { scope: "screen", resource: "geofences" },
  });
}

export function useDeleteGeofence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, signal }: DeleteGeofenceVariables) =>
      api.deleteGeofence(id, signal ? { signal } : {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.geofences });
    },
    meta: { scope: "screen", resource: "geofences" },
  });
}

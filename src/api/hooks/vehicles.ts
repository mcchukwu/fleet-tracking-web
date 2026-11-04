import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";
import type {
  HistoryRange,
  VehicleEventRange,
  VehicleFilters,
  VehicleUpdate,
} from "../types";

const SNAPSHOT_REFRESH_MS = 60_000;

export function liveSnapshotQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.liveSnapshot,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api.liveSnapshot({ signal }).then((response) => response.data),
    staleTime: 0,
    refetchInterval: SNAPSHOT_REFRESH_MS,
    meta: { scope: "map", resource: "live-snapshot" },
  });
}

export function useLiveSnapshot() {
  return useQuery(liveSnapshotQueryOptions());
}

export function useVehicles(filters: VehicleFilters = {}) {
  return useQuery({
    queryKey: queryKeys.vehicles(filters),
    queryFn: ({ signal }) => api.vehicles(filters, { signal }).then((response) => response.data),
    placeholderData: keepPreviousData,
    meta: { scope: "screen", resource: "vehicles" },
  });
}

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.vehicle(id ?? ""),
    queryFn: ({ signal }) => {
      if (!id) throw new Error("useVehicle requires an id");
      return api.vehicle(id, { signal }).then((response) => response.data);
    },
    enabled: Boolean(id),
    meta: { scope: "panel", resource: "vehicle" },
  });
}

export function useVehicleEvents(id: string | undefined, range: VehicleEventRange = {}) {
  return useQuery({
    queryKey: queryKeys.vehicleEvents(id ?? "", range),
    queryFn: ({ signal }) => {
      if (!id) throw new Error("useVehicleEvents requires an id");
      return api.vehicleEvents(id, range, { signal }).then((response) => response.data);
    },
    enabled: Boolean(id),
    meta: { scope: "panel", resource: "vehicle-events" },
  });
}

export function useVehicleHistory(id: string | undefined, range: HistoryRange) {
  return useQuery({
    queryKey: queryKeys.vehicleHistory(id ?? "", range),
    queryFn: ({ signal }) => {
      if (!id) throw new Error("useVehicleHistory requires an id");
      return api.history(id, range, { signal });
    },
    enabled: Boolean(id),
    meta: { scope: "screen", resource: "vehicle-history" },
  });
}

export function useUpdateVehicle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: VehicleUpdate) => api.updateVehicle(id, update),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vehicle(id) }),
        queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.liveSnapshot }),
      ]);
    },
    meta: { scope: "panel", resource: "vehicle" },
  });
}

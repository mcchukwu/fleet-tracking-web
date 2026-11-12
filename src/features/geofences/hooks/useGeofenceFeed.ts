import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGeofences } from "../../../api/hooks/geofences";
import { queryKeys } from "../../../api/keys";
import type { Geofence } from "../../../api/types";

export interface GeofenceFeedController {
  geofences: Geofence[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  dataUpdatedAt: number;
  cancelled: boolean;
  refetch: () => Promise<Geofence[] | undefined>;
  retry: () => Promise<Geofence[] | undefined>;
  cancel: () => void;
}

/**
 * Administrative state: fetch on mount and focus, never poll. The server
 * returns the whole tenant and ignores every query parameter.
 */
export function useGeofenceFeed(): GeofenceFeedController {
  const query = useGeofences({ staleTime: 0, refetchOnWindowFocus: true });
  const queryClient = useQueryClient();
  const [cancelled, setCancelled] = useState(false);
  const dataUpdatedAt = query.dataUpdatedAt;

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- fresh data is the external event that clears Cancel.
    if (query.data !== undefined || dataUpdatedAt > 0) setCancelled(false);
  }, [query.data, dataUpdatedAt]);

  const geofences = useMemo(() => query.data ?? [], [query.data]);

  const refetch = useCallback(async (): Promise<Geofence[] | undefined> => {
    const result = await query.refetch();
    return result.data;
  }, [query]);

  const cancel = useCallback(() => {
    setCancelled(true);
    void queryClient.cancelQueries({ queryKey: queryKeys.geofences });
  }, [queryClient]);

  return {
    geofences,
    isLoading: query.isLoading && !cancelled,
    isFetching: query.isFetching,
    error: query.error,
    dataUpdatedAt,
    cancelled,
    refetch,
    retry: refetch,
    cancel,
  };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDrivers } from "../../../api/hooks/drivers";
import { queryKeys } from "../../../api/keys";
import type { Driver } from "../../../api/types";

export interface DriverFeedController {
  drivers: Driver[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  dataUpdatedAt: number;
  cancelled: boolean;
  refetch: () => void;
  cancel: () => void;
}

/**
 * The list is administrative state: fetch on mount and focus, never poll.
 * `GET /drivers` returns the whole tenant, so there is no paging to manage.
 */
export function useDriverFeed(): DriverFeedController {
  const query = useDrivers({ staleTime: 0, refetchOnWindowFocus: true });
  const queryClient = useQueryClient();
  const [cancelled, setCancelled] = useState(false);
  const dataUpdatedAt = query.dataUpdatedAt;

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- fresh data is the external event that clears Cancel.
    if (query.data !== undefined || dataUpdatedAt > 0) setCancelled(false);
  }, [query.data, dataUpdatedAt]);

  const drivers = useMemo(() => query.data ?? [], [query.data]);

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  const cancel = useCallback(() => {
    setCancelled(true);
    void queryClient.cancelQueries({ queryKey: queryKeys.drivers });
  }, [queryClient]);

  return {
    drivers,
    isLoading: query.isPending && !cancelled,
    isFetching: query.isFetching,
    error: query.error,
    dataUpdatedAt,
    cancelled,
    refetch,
    cancel,
  };
}

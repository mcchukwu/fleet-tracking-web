import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuditFeedQuery } from "../../../api/hooks/audit";
import { queryKeys } from "../../../api/keys";
import type { AuditEntry } from "../../../api/types";
import { useConnectionStore } from "../../../stores/connection";
import { flattenAuditPages } from "../lib/audit";

export interface AuditFeedController {
  entries: AuditEntry[];
  loadedCount: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  error: unknown;
  dataUpdatedAt: number;
  cancelled: boolean;
  online: boolean;
  loadMore: () => void;
  refetch: () => void;
  cancel: () => void;
}

export function useAuditFeed(): AuditFeedController {
  const network = useConnectionStore((state) => state.network);
  const online = network !== "offline";
  const query = useAuditFeedQuery(online);
  const queryClient = useQueryClient();
  // A successful page response after the marker clears the cancelled state
  // without an effect: the marker is the last update time at the moment of cancel.
  const [cancelMarker, setCancelMarker] = useState<number | null>(null);
  const cancelled =
    cancelMarker !== null && query.dataUpdatedAt <= cancelMarker;

  const entries = useMemo(
    () => flattenAuditPages((query.data?.pages ?? []).map((page) => page.data)),
    [query.data?.pages],
  );

  const loadMore = useCallback(() => {
    if (!online || cancelled || !query.hasNextPage || query.isFetchingNextPage) return;
    void query.fetchNextPage();
  }, [cancelled, online, query]);

  const refetch = useCallback(() => {
    setCancelMarker(null);
    void query.refetch();
  }, [query]);

  const cancel = useCallback(() => {
    setCancelMarker(query.dataUpdatedAt);
    void queryClient.cancelQueries({ queryKey: queryKeys.auditFeed });
  }, [query.dataUpdatedAt, queryClient]);

  return {
    entries,
    loadedCount: entries.length,
    hasMore: query.hasNextPage ?? false,
    isLoading: query.isPending && !cancelled && online,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error,
    dataUpdatedAt: query.dataUpdatedAt,
    cancelled,
    online,
    loadMore,
    refetch,
    cancel,
  };
}

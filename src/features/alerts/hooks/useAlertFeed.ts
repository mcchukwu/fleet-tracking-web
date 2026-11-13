import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAlertFeed as useAlertFeedQuery } from "../../../api/hooks/alerts";
import type { Alert } from "../../../api/types";
import { queryKeys } from "../../../api/keys";
import { NEW_ALERT_HIGHLIGHT_MS } from "../lib/constants";
import { flattenPages, nextFeedView } from "../lib/feed";
import { filterSignature, serverFilters, type AlertFilterValues } from "../lib/filter";

export interface AlertFeedController {
  visible: Alert[];
  loadedCount: number;
  hasMore: boolean;
  isLoading: boolean;
  cancelled: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  error: unknown;
  loadMore: () => void;
  refetch: () => void;
  cancel: () => void;
  atTop: boolean;
  setAtTop: (atTop: boolean) => void;
  newCount: number;
  revealNew: () => void;
  highlightIds: ReadonlySet<string>;
}

export function useAlertFeed(filters: AlertFilterValues): AlertFeedController {
  const signature = filterSignature(filters);
  const query = useAlertFeedQuery(serverFilters(filters));
  const queryClient = useQueryClient();
  const incoming = useMemo(() => flattenPages(query.data?.pages ?? []), [query.data?.pages]);

  const [visible, setVisible] = useState<Alert[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [highlightIds, setHighlightIds] = useState<ReadonlySet<string>>(new Set());
  const [atTop, setAtTop] = useState(true);
  const [cancelled, setCancelled] = useState(false);

  const previousIncoming = useRef<Alert[]>([]);
  const pendingRef = useRef<ReadonlySet<string>>(new Set());
  const signatureRef = useRef(signature);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = signatureRef.current !== signature;
    signatureRef.current = signature;
    if (reset || incoming.length > 0) setCancelled(false);

    const view = nextFeedView({
      previousVisible: previousIncoming.current,
      previousPendingIds: pendingRef.current,
      incoming,
      atTop,
      reset,
    });
    previousIncoming.current = incoming;
    pendingRef.current = new Set(view.pending.map((alert) => alert.id));
    setVisible(view.visible);
    setNewCount(view.newCount);
    setHighlightIds(view.highlightIds);

    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    if (view.highlightIds.size > 0) {
      highlightTimer.current = setTimeout(() => {
        highlightTimer.current = null;
        setHighlightIds(new Set());
      }, NEW_ALERT_HIGHLIGHT_MS);
    }
  }, [incoming, atTop, signature]);

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

  const loadMore = useCallback(() => {
    void query.fetchNextPage();
  }, [query]);

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  const cancel = useCallback(() => {
    setCancelled(true);
    void queryClient.cancelQueries({ queryKey: queryKeys.alertsFeed(serverFilters(filters)) });
  }, [filters, queryClient]);

  const revealNew = useCallback(() => setAtTop(true), []);

  return {
    visible,
    loadedCount: incoming.length,
    hasMore: query.hasNextPage ?? false,
    isLoading: query.isLoading && !cancelled,
    cancelled,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error,
    loadMore,
    refetch,
    cancel,
    atTop,
    setAtTop,
    newCount,
    revealNew,
    highlightIds,
  };
}

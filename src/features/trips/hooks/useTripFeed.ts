import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTripsFeed as useTripsFeedQuery } from "../../../api/hooks/trips";
import { queryKeys } from "../../../api/keys";
import type { Trip, TripServerFilters } from "../../../api/types";
import { useConnection } from "../../../stores/connection";
import { filterTrips, sortTrips, type TripSort } from "../../../lib/trips";

const REFRESH_MS = 15_000;

export interface TripFeedController {
  trips: Trip[];
  loadedCount: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  error: unknown;
  dataUpdatedAt: number;
  cancelled: boolean;
  loadMore: () => void;
  refetch: () => void;
  cancel: () => void;
}

function flattenPages(pages: readonly Trip[][] | undefined): Trip[] {
  return pages ? pages.flat() : [];
}

export function visibleTrips(trips: readonly Trip[], query: string, sort: TripSort): Trip[] {
  return sortTrips(filterTrips(trips, query), sort);
}

export function useTripFeed(filters: TripServerFilters): TripFeedController {
  const online = useConnection().network === "online";
  const query = useTripsFeedQuery(filters, {
    refetchInterval: online ? REFRESH_MS : false,
  });
  const queryClient = useQueryClient();
  const incoming = useMemo(() => flattenPages(query.data?.pages), [query.data?.pages]);

  const [cancelled, setCancelled] = useState(false);
  const signature = JSON.stringify(filters);
  const signatureRef = useRef(signature);
  const inFlightPage = useRef(false);
  const dataUpdatedAt = query.dataUpdatedAt;

  useEffect(() => {
    const reset = signatureRef.current !== signature;
    signatureRef.current = signature;
    if (reset || incoming.length > 0 || dataUpdatedAt > 0) setCancelled(false);
  }, [incoming, signature, dataUpdatedAt]);

  const loadMore = useCallback(() => {
    if (!online) return;
    if (inFlightPage.current || !query.hasNextPage || query.isFetchingNextPage) return;
    inFlightPage.current = true;
    void query.fetchNextPage().finally(() => {
      inFlightPage.current = false;
    });
  }, [online, query]);

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  const cancel = useCallback(() => {
    setCancelled(true);
    void queryClient.cancelQueries({ queryKey: queryKeys.tripsFeed(filters) });
  }, [filters, queryClient]);

  return {
    trips: incoming,
    loadedCount: incoming.length,
    hasMore: query.hasNextPage ?? false,
    isLoading: query.isLoading && !cancelled,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error,
    dataUpdatedAt: query.dataUpdatedAt,
    cancelled,
    loadMore,
    refetch,
    cancel,
  };
}

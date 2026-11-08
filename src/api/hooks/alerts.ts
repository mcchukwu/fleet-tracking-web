import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";
import type { AlertFilters, AlertServerFilters } from "../types";

export const ALERTS_PAGE_SIZE = 500;
export const OPEN_ALERT_LIMIT = 500;

const openAlertFilters: AlertFilters = { status: "open", limit: OPEN_ALERT_LIMIT };

export function openAlertsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.alerts(openAlertFilters),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api.alerts(openAlertFilters, { signal }).then((response) => response.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
    meta: { scope: "map", resource: "alerts" },
  });
}

export function useOpenAlerts(enabled = true) {
  return useQuery({ ...openAlertsQueryOptions(), enabled });
}

export function useAlerts(filters: AlertFilters = {}) {
  return useQuery({
    queryKey: queryKeys.alerts(filters),
    queryFn: ({ signal }) => api.alerts(filters, { signal }).then((response) => response.data),
    placeholderData: keepPreviousData,
    meta: { scope: "screen", resource: "alerts" },
  });
}

/** The server filters are only status and type; severity and plate search stay client-side. */
export function alertFeedQueryOptions(filters: AlertServerFilters) {
  return infiniteQueryOptions({
    queryKey: queryKeys.alertsFeed(filters),
    queryFn: ({ pageParam, signal }: { pageParam: number; signal: AbortSignal }) =>
      api
        .alerts({ ...filters, limit: ALERTS_PAGE_SIZE, offset: pageParam }, { signal })
        .then((response) => response.data),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length === ALERTS_PAGE_SIZE ? lastPageParam + ALERTS_PAGE_SIZE : undefined,
    staleTime: 15_000,
    meta: { scope: "screen", resource: "alerts" },
  });
}

export function useAlertFeed(filters: AlertServerFilters) {
  return useInfiniteQuery(alertFeedQueryOptions(filters));
}

export function alertLookupQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: queryKeys.alertLookup(id),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const response = await api.alerts({ limit: ALERTS_PAGE_SIZE }, { signal });
      return response.data.find((alert) => alert.id === id) ?? null;
    },
    enabled,
    staleTime: 30_000,
    meta: { scope: "panel", resource: "alert" },
  });
}

/** There is no GET /alerts/{id}; a deep link resolves against the list. */
export function useAlertLookup(id: string | null, enabled = true) {
  return useQuery({
    ...alertLookupQueryOptions(id ?? "", Boolean(id) && enabled),
    enabled: Boolean(id) && enabled,
  });
}

export function useAckAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.ackAlert(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.systemHealth }),
      ]);
    },
    meta: { scope: "screen", resource: "alerts" },
  });
}

export function useAlertRules() {
  return useQuery({
    queryKey: queryKeys.alertRules,
    queryFn: ({ signal }) => api.alertRules({ signal }).then((response) => response.data),
    meta: { scope: "screen", resource: "alert-rules" },
  });
}

export function useUpdateAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      update,
    }: {
      id: string;
      update: { enabled?: boolean; config?: Record<string, unknown> };
    }) => api.updateAlertRule(id, update),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.alertRules });
    },
    meta: { scope: "screen", resource: "alert-rules" },
  });
}

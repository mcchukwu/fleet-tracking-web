import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";
import type { AlertFilters } from "../types";

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

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";
import type { AlertFilters } from "../types";

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
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
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

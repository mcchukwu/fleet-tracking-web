import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";
import type { AuditFilters } from "../types";

export function useAudit(filters: AuditFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.audit(filters),
    queryFn: ({ signal }) => api.audit(filters, { signal }).then((response) => response.data),
    enabled,
    placeholderData: keepPreviousData,
    meta: { scope: "screen", resource: "audit" },
  });
}

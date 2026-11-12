import { infiniteQueryOptions, queryOptions, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";

export const AUDIT_PAGE_SIZE = 100;
export const AUDIT_LOOKUP_LIMIT = 500;

export function auditFeedQueryOptions(enabled = true) {
  return infiniteQueryOptions({
    queryKey: queryKeys.auditFeed,
    queryFn: ({ pageParam, signal }: { pageParam: number; signal: AbortSignal }) =>
      api
        .audit({ limit: AUDIT_PAGE_SIZE, offset: pageParam }, { signal })
        .then((response) => response.data),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length === AUDIT_PAGE_SIZE
        ? lastPageParam + AUDIT_PAGE_SIZE
        : undefined,
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled,
    meta: { scope: "screen", resource: "audit" },
  });
}

export function useAuditFeedQuery(enabled = true) {
  return useInfiniteQuery(auditFeedQueryOptions(enabled));
}

export function auditLookupQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: queryKeys.auditLookup(id),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const response = await api.audit({ limit: AUDIT_LOOKUP_LIMIT, offset: 0 }, { signal });
      return response.data.find((entry) => String(entry.id) === id) ?? null;
    },
    enabled,
    staleTime: 30_000,
    meta: { scope: "panel", resource: "audit" },
  });
}

/** There is no GET /audit/{id}; a deep link resolves against the newest 500 rows. */
export function useAuditLookup(id: string | null, enabled = true) {
  const active = Boolean(id) && enabled;
  return useQuery({
    ...auditLookupQueryOptions(id ?? "", active),
    enabled: active,
  });
}

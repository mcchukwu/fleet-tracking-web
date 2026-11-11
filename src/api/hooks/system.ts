import { useQuery } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";

export function useSystemHealth(
  options: { enabled?: boolean; refetchInterval?: number | false } = {},
) {
  return useQuery({
    queryKey: queryKeys.systemHealth,
    queryFn: ({ signal }) => api.systemHealth({ signal }),
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval ?? false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    meta: { scope: "screen", resource: "system-health" },
  });
}

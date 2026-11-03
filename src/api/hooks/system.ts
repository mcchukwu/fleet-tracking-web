import { useQuery } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";

export function useSystemHealth(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.systemHealth,
    queryFn: ({ signal }) => api.systemHealth({ signal }),
    enabled: options.enabled ?? true,
    meta: { scope: "screen", resource: "system-health" },
  });
}

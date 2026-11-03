import { useQuery } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";

export function useReportSummary(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports(from, to),
    queryFn: ({ signal }) => api.reportSummary(from, to, { signal }),
    enabled: enabled && Boolean(from) && Boolean(to),
    meta: { scope: "screen", resource: "reports" },
  });
}

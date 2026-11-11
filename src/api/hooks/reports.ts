import { useQuery } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";

export function useReportSummary(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports(from, to),
    queryFn: ({ signal }) => api.reportSummary(from, to, { signal }),
    enabled: enabled && Boolean(from) && Boolean(to),
    // A report is a snapshot of a period; returning to the screen should not
    // show figures that are up to 30s old merely because the cache is fresh.
    staleTime: 0,
    meta: { scope: "screen", resource: "reports" },
  });
}

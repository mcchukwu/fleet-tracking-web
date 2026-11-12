import { useEffect, useRef, useState } from "react";
import type { SystemHealth } from "../../../api/schemas";
import type { HealthSample, HealthTrend } from "../lib/health";

export interface UseHealthTrendOptions {
  data: SystemHealth | undefined;
  dataUpdatedAt: number;
  mountedAt: number;
}

const emptyTrend: HealthTrend = {
  first: null,
  current: null,
  previous: null,
  reset: false,
};

/**
 * Tracks the first sample after the page opened and the sample before the
 * current one. Cached data older than the mount is displayed but never used
 * as a baseline, so a delta always belongs to this operator's session.
 */
export function useHealthTrend({
  data,
  dataUpdatedAt,
  mountedAt,
}: UseHealthTrendOptions): HealthTrend {
  const [trend, setTrend] = useState<HealthTrend>(emptyTrend);
  const lastAt = useRef(0);
  const lastSample = useRef<HealthSample | null>(null);

  useEffect(() => {
    if (!data || !Number.isFinite(dataUpdatedAt) || dataUpdatedAt <= 0) return;
    if (dataUpdatedAt <= lastAt.current) return;
    lastAt.current = dataUpdatedAt;
    if (dataUpdatedAt < mountedAt) return;

    const sample: HealthSample = { data, at: dataUpdatedAt };
    const prior = lastSample.current;
    lastSample.current = sample;

    setTrend((state) => {
      const reset =
        prior !== null &&
        sample.data.ingest.received < prior.data.ingest.received;
      return {
        first: reset ? sample : (state.first ?? sample),
        current: sample,
        previous: prior,
        reset,
      };
    });
  }, [data, dataUpdatedAt, mountedAt]);

  return trend;
}

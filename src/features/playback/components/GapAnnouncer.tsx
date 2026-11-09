import { formatPlaybackTime } from "../../../lib/format";
import { gapLabel, type RouteGap } from "../lib/history";

export interface GapAnnouncerProps {
  inGap: boolean;
  playheadMs: number;
  gaps: readonly RouteGap[];
  includeDate?: boolean;
}

/**
 * The label is stable while the cursor stays in the same gap, so the polite
 * live region announces the entry once and stays quiet afterwards.
 */
export function GapAnnouncer({
  inGap,
  playheadMs,
  gaps,
  includeDate = false,
}: GapAnnouncerProps) {
  const gap = inGap
    ? gaps.find((item) => playheadMs > item.startMs && playheadMs < item.endMs)
    : undefined;
  const message = gap
    ? gapLabel(gap, (ms) =>
        formatPlaybackTime(new Date(ms).toISOString(), includeDate).replace(/:\d{2}$/, ""),
      )
    : "";

  return (
    <output aria-live="polite" className="sr-only">
      {message}
    </output>
  );
}

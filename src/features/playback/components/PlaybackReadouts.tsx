import { memo } from "react";
import { MISSING, formatHeading, formatSpeed } from "../../../lib/format";
import type { Cursor } from "../lib/history";

export interface PlaybackReadoutsProps {
  cursor: Cursor;
  inGap: boolean;
  className?: string;
}

/** The only text that changes on every clock tick. */
export const PlaybackReadouts = memo(function PlaybackReadouts({
  cursor,
  inGap,
  className,
}: PlaybackReadoutsProps) {
  return (
    <div data-testid="playback-readout" className={className}>
      <span className="min-w-16 text-right tabular-nums">
        {formatSpeed(inGap ? null : cursor.speedKph)}
      </span>
      <span className="min-w-14 tabular-nums">
        {inGap ? MISSING : formatHeading(cursor.headingDeg)}
      </span>
    </div>
  );
});

import { memo, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import { formatPlaybackTime } from "../../../lib/format";
import { cn } from "../../../ui/cn";
import type { PlaybackEvent } from "../lib/events";

const DOT_INSET_PX = 4;

const severityColor: Record<string, string> = {
  low: "text-sev-low",
  medium: "text-sev-medium",
  high: "text-sev-high",
  critical: "text-sev-critical",
};

const severityShape: Record<string, string> = {
  low: "h-1 w-2 rounded-full",
  medium: "size-2 rounded-full",
  high: "size-2 rotate-45 rounded-none",
  critical: "size-2 rounded-none",
};

function percentLeft(percent: number): CSSProperties {
  // guard-ignore: runtime event position, clamped so the dot never protrudes over a time label.
  return {
    left: `clamp(${DOT_INSET_PX}px, ${percent}%, calc(100% - ${DOT_INSET_PX}px))`,
  };
}

export interface PlaybackEventMarkersProps {
  events: readonly PlaybackEvent[];
  includeDate: boolean;
  rovingIndex: number;
  markerRefs: RefObject<Array<HTMLButtonElement | null>>;
  onSeek: (timeMs: number) => void;
  onFocusMarker: (index: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
}

/**
 * Memoised so the 20fps playback clock does not rebuild every event marker.
 * The lane's pointer handlers stay in the scrubber; this owns only the buttons.
 */
export const PlaybackEventMarkers = memo(function PlaybackEventMarkers({
  events,
  includeDate,
  rovingIndex,
  markerRefs,
  onSeek,
  onFocusMarker,
  onKeyDown,
}: PlaybackEventMarkersProps) {
  return (
    <>
      {events.map((event, index) => (
        <button
          key={event.key}
          ref={(node) => {
            markerRefs.current[index] = node;
          }}
          type="button"
          data-testid="playback-event-marker"
          tabIndex={index === rovingIndex ? 0 : -1}
          aria-label={`${event.label}${event.severity ? ` (${event.severity})` : ""} at ${formatPlaybackTime(event.at, includeDate)}`}
          onClick={() => onSeek(event.atMs)}
          onFocus={() => onFocusMarker(index)}
          onKeyDown={(keyEvent) => onKeyDown(keyEvent, index)}
          className={cn(
            "group size-touch md:size-control-sm pointer-events-none absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm outline-none",
            event.severity ? severityColor[event.severity] : "text-muted",
          )}
          style={percentLeft(event.percent)}
        >
          <span
            aria-hidden="true"
            className={cn(
              "group-focus-visible:ring-focus-ring group-focus-visible:ring-offset-surface block bg-current group-focus-visible:ring-2 group-focus-visible:ring-offset-2",
              event.severity ? severityShape[event.severity] : "size-2 rounded-full",
            )}
          />
        </button>
      ))}
    </>
  );
});

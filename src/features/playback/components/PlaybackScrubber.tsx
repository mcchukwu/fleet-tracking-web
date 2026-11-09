import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatPlaybackTime } from "../../../lib/format";
import { cn } from "../../../ui/cn";
import type { PlaybackEvent } from "../lib/events";
import type { RouteGap } from "../lib/history";

export interface PlaybackScrubberProps {
  fromMs: number;
  toMs: number;
  playheadMs: number;
  gaps: readonly RouteGap[];
  events: readonly PlaybackEvent[];
  onSeek: (timeMs: number) => void;
  disabled?: boolean;
  includeDate?: boolean;
  className?: string;
}

const STEP_MS = 1_000;
const MIN_MARKER_WIDTH = 24;
const COMFORTABLE_MARKER_WIDTH = 44;
const FALLBACK_BAND_WIDTH = 480;

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

function leftAt(percent: number): CSSProperties {
  // guard-ignore: runtime timeline position; no utility class can express an arbitrary percentage.
  return { left: `${percent}%` };
}

function bandStyle(startPercent: number, widthPercent: number): CSSProperties {
  // guard-ignore: runtime gap band; no utility class can express an arbitrary percentage width.
  return { left: `${startPercent}%`, width: `${widthPercent}%` };
}

function markerStyle(left: number, width: number): CSSProperties {
  // guard-ignore: runtime marker position and hit-area width come from the measured track.
  return { left: `${left}px`, width: `${width}px` };
}

function dotStyle(left: number): CSSProperties {
  // guard-ignore: the dot keeps its time position inside an edge-clamped hit area.
  return { left: `${left}px` };
}

function percentOf(timeMs: number, fromMs: number, toMs: number): number {
  const span = Math.max(1, toMs - fromMs);
  return Math.min(100, Math.max(0, ((timeMs - fromMs) / span) * 100));
}

function useBandWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(FALLBACK_BAND_WIDTH);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const next = element.getBoundingClientRect().width;
      if (next > 0) setWidth(next);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

function markerWidthFor(events: readonly PlaybackEvent[], bandWidth: number): number | null {
  if (events.length === 0) return null;
  const percents = events.map((event) => event.percent).sort((a, b) => a - b);
  let previous: number | null = null;
  let minGap = 100;
  for (const percent of percents) {
    if (previous !== null) minGap = Math.min(minGap, percent - previous);
    previous = percent;
  }
  const available = (minGap / 100) * bandWidth;
  if (available >= COMFORTABLE_MARKER_WIDTH) return COMFORTABLE_MARKER_WIDTH;
  if (available >= MIN_MARKER_WIDTH) return MIN_MARKER_WIDTH;
  return null;
}

function placementFor(percent: number, bandWidth: number, markerWidth: number) {
  const center = (percent / 100) * bandWidth;
  const left = Math.min(
    Math.max(center - markerWidth / 2, 0),
    Math.max(0, bandWidth - markerWidth),
  );
  return { left, dotLeft: center - left };
}

export function PlaybackScrubber({
  fromMs,
  toMs,
  playheadMs,
  gaps,
  events,
  onSeek,
  disabled = false,
  includeDate = false,
  className,
}: PlaybackScrubberProps) {
  const inGap = gaps.some((gap) => playheadMs > gap.startMs && playheadMs < gap.endMs);
  const currentIso = new Date(playheadMs).toISOString();
  const valueText = `${formatPlaybackTime(currentIso, includeDate)}${inGap ? ", no data" : ""}`;
  const [bandRef, bandWidth] = useBandWidth();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const markerWidth = markerWidthFor(events, bandWidth);

  const seekAt = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const raw = fromMs + ratio * (toMs - fromMs);
    const snapped = fromMs + Math.round((raw - fromMs) / STEP_MS) * STEP_MS;
    onSeek(Math.min(toMs, Math.max(fromMs, snapped)));
  };

  const startSeek = (event: ReactPointerEvent<HTMLInputElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    seekAt(event.clientX);
  };

  const moveSeek = (event: ReactPointerEvent<HTMLInputElement>) => {
    if (!draggingRef.current || disabled) return;
    seekAt(event.clientX);
  };

  const endSeek = (event: ReactPointerEvent<HTMLInputElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div data-testid="playback-scrubber" className={cn("flex min-w-0 items-end gap-2", className)}>
      <span className="flex h-touch min-w-14 shrink-0 items-center text-xs tabular-nums text-muted md:h-control-md">
        {formatPlaybackTime(new Date(fromMs).toISOString(), includeDate)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          ref={bandRef}
          data-testid="playback-event-band"
          className="relative h-5 w-full"
        >
          {events.map((event) => {
            if (markerWidth === null) {
              return (
                <span
                  key={event.key}
                  data-testid="playback-event-tick"
                  aria-hidden="true"
                  className={cn(
                    "absolute top-0 h-2 w-0.5 -translate-x-1/2 rounded-full bg-current",
                    event.severity ? severityColor[event.severity] : "text-muted",
                  )}
                  style={leftAt(event.percent)}
                />
              );
            }
            const placement = placementFor(event.percent, bandWidth, markerWidth);
            return (
              <button
                key={event.key}
                type="button"
                data-testid="playback-event-marker"
                onClick={() => onSeek(event.atMs)}
                aria-label={`${event.label}${event.severity ? ` (${event.severity})` : ""} at ${formatPlaybackTime(event.at, includeDate)}`}
                className={cn(
                  "absolute top-0 flex h-5 items-start justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring",
                  event.severity ? severityColor[event.severity] : "text-muted",
                )}
                style={markerStyle(placement.left, markerWidth)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-1 block -translate-x-1/2 bg-current",
                    event.severity ? severityShape[event.severity] : "size-2 rounded-full",
                  )}
                  style={dotStyle(placement.dotLeft)}
                />
              </button>
            );
          })}
        </div>
        <div
          ref={trackRef}
          data-testid="playback-scrubber-track"
          className="relative flex h-touch min-w-0 items-center md:h-control-md"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-3"
          />
          {gaps.map((gap) => {
            const start = percentOf(gap.startMs, fromMs, toMs);
            const end = percentOf(gap.endMs, fromMs, toMs);
            return (
              <span
                key={`${gap.startMs}-${gap.endMs}`}
                data-testid="gap-band"
                aria-hidden="true"
                className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-idle-bg"
                style={bandStyle(start, Math.max(0.5, end - start))}
              />
            );
          })}
          <input
            type="range"
            aria-label="Playback position"
            aria-valuetext={valueText}
            min={fromMs}
            max={toMs}
            step={STEP_MS}
            value={playheadMs}
            disabled={disabled}
            onChange={(event) => onSeek(Number(event.target.value))}
            onPointerDown={startSeek}
            onPointerMove={moveSeek}
            onPointerUp={endSeek}
            onPointerCancel={endSeek}
            onLostPointerCapture={() => {
              draggingRef.current = false;
            }}
            onMouseDown={(event) => {
              if (!disabled) event.preventDefault();
            }}
            className="relative z-20 h-full w-full touch-none cursor-pointer appearance-none bg-transparent accent-accent disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>
      <span
        data-testid="playback-current-time"
        className="flex h-touch min-w-16 shrink-0 items-center justify-center text-center text-xs tabular-nums text-muted md:h-control-md"
      >
        {formatPlaybackTime(currentIso, includeDate)}
      </span>
      <span className="flex h-touch min-w-14 shrink-0 items-center justify-end text-right text-xs tabular-nums text-muted md:h-control-md">
        {formatPlaybackTime(new Date(toMs).toISOString(), includeDate)}
      </span>
    </div>
  );
}

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatPlaybackTime } from "../../../lib/format";
import { cn } from "../../../ui/cn";
import { nearestEventIndex, type PlaybackEvent } from "../lib/events";
import type { RouteGap } from "../lib/history";
import { PlaybackEventMarkers } from "./PlaybackEventMarkers";

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

function bandStyle(startPercent: number, widthPercent: number): CSSProperties {
  // guard-ignore: runtime gap band; no utility class can express an arbitrary percentage width.
  return { left: `${startPercent}%`, width: `${widthPercent}%` };
}

function percentOf(timeMs: number, fromMs: number, toMs: number): number {
  const span = Math.max(1, toMs - fromMs);
  return Math.min(100, Math.max(0, ((timeMs - fromMs) / span) * 100));
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
  const laneRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const draggingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const rovingIndex = events.length > 0 ? Math.min(activeIndex, events.length - 1) : -1;
  const preview = previewIndex === null ? null : (events[previewIndex] ?? null);

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

  const eventAt = (clientX: number) => {
    const lane = laneRef.current;
    if (!lane) return null;
    const rect = lane.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const percent = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const index = nearestEventIndex(events, percent);
    return index === -1 ? null : { index, event: events[index] };
  };

  const previewAt = (clientX: number) => {
    const hit = eventAt(clientX);
    setPreviewIndex(hit ? hit.index : null);
    return hit;
  };

  const handleLanePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const hit = previewAt(event.clientX);
    if (!hit) return;
    event.preventDefault();
    setActiveIndex(hit.index);
    onSeek(hit.event.atMs);
  };

  const handleLanePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") setPreviewIndex(null);
  };

  const focusMarker = useCallback(
    (index: number) => {
      const next = (index + events.length) % events.length;
      setActiveIndex(next);
      markerRefs.current[next]?.focus();
    },
    [events.length],
  );

  const handleMarkerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
      if (events.length === 0) return;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        focusMarker(index + 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        focusMarker(index - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        event.stopPropagation();
        focusMarker(0);
      } else if (event.key === "End") {
        event.preventDefault();
        event.stopPropagation();
        focusMarker(events.length - 1);
      }
    },
    [events.length, focusMarker],
  );

  const focusMarkerAt = useCallback((index: number) => setActiveIndex(index), []);
  const seekToEvent = useCallback((atMs: number) => onSeek(atMs), [onSeek]);

  return (
    <div data-testid="playback-scrubber" className={cn("flex min-w-0 items-end gap-2", className)}>
      <span className="h-touch text-muted md:h-control-md flex min-w-14 shrink-0 items-center text-xs tabular-nums">
        {formatPlaybackTime(new Date(fromMs).toISOString(), includeDate)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          ref={(node) => {
            laneRef.current = node;
          }}
          data-testid="playback-event-band"
          className="h-touch md:h-control-sm relative w-full touch-none"
          onPointerMove={(event) => {
            if (!disabled) previewAt(event.clientX);
          }}
          onPointerDown={handleLanePointerDown}
          onPointerUp={handleLanePointerUp}
          onPointerCancel={() => setPreviewIndex(null)}
          onPointerLeave={() => setPreviewIndex(null)}
        >
          <PlaybackEventMarkers
            events={events}
            includeDate={includeDate}
            rovingIndex={rovingIndex}
            markerRefs={markerRefs}
            onSeek={seekToEvent}
            onFocusMarker={focusMarkerAt}
            onKeyDown={handleMarkerKeyDown}
          />
        </div>
        <div
          ref={trackRef}
          data-testid="playback-scrubber-track"
          className="h-touch md:h-control-md relative flex min-w-0 items-center"
        >
          <div
            aria-hidden="true"
            className="bg-surface-3 absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
          />
          {gaps.map((gap) => {
            const start = percentOf(gap.startMs, fromMs, toMs);
            const end = percentOf(gap.endMs, fromMs, toMs);
            return (
              <span
                key={`${gap.startMs}-${gap.endMs}`}
                data-testid="gap-band"
                aria-hidden="true"
                className="bg-idle-bg absolute top-1/2 h-3 -translate-y-1/2 rounded-sm"
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
            className="accent-accent z-panel relative h-full w-full cursor-pointer touch-none appearance-none bg-transparent disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>
      <span
        data-testid="playback-current-time"
        className="h-touch text-muted md:h-control-md flex w-24 min-w-24 shrink-0 items-center justify-center truncate text-center text-xs tabular-nums"
      >
        {preview ? preview.label : formatPlaybackTime(currentIso, includeDate)}
      </span>
      <span className="h-touch text-muted md:h-control-md flex min-w-14 shrink-0 items-center justify-end text-right text-xs tabular-nums">
        {formatPlaybackTime(new Date(toMs).toISOString(), includeDate)}
      </span>
    </div>
  );
}

import type { CSSProperties } from "react";
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
  className?: string;
}

const severityColor: Record<string, string> = {
  low: "text-sev-low",
  medium: "text-sev-medium",
  high: "text-sev-high",
  critical: "text-sev-critical",
};

function leftAt(percent: number): CSSProperties {
  // guard-ignore: runtime timeline position; no utility class can express an arbitrary percentage.
  return { left: `${percent}%` };
}

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
  className,
}: PlaybackScrubberProps) {
  const inGap = gaps.some((gap) => playheadMs > gap.startMs && playheadMs < gap.endMs);
  const currentIso = new Date(playheadMs).toISOString();
  const valueText = `${formatPlaybackTime(currentIso)}${inGap ? ", no data" : ""}`;

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="min-w-14 shrink-0 text-xs tabular-nums text-muted">
        {formatPlaybackTime(new Date(fromMs).toISOString())}
      </span>
      <div className="relative flex h-touch min-w-0 flex-1 items-center md:h-control-md">
        <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-3" />
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
        {events.map((event) => (
          <button
            key={event.key}
            type="button"
            onClick={() => onSeek(event.atMs)}
            aria-label={`${event.label} at ${formatPlaybackTime(event.at)}`}
            className={cn(
              "absolute top-0 z-10 flex size-touch -translate-x-1/2 items-start justify-center focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring md:size-4",
              event.severity ? severityColor[event.severity] : "text-muted",
            )}
            style={leftAt(event.percent)}
          >
            <span aria-hidden="true" className="mt-1 block size-2 rounded-full bg-current" />
          </button>
        ))}
        <input
          type="range"
          aria-label="Playback position"
          aria-valuetext={valueText}
          min={fromMs}
          max={toMs}
          step={1_000}
          value={playheadMs}
          disabled={disabled}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="relative z-20 h-full w-full cursor-pointer appearance-none bg-transparent accent-accent disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
      <span
        data-testid="playback-current-time"
        className="min-w-16 shrink-0 text-center text-xs tabular-nums text-muted"
      >
        {formatPlaybackTime(currentIso)}
      </span>
      <span className="min-w-14 shrink-0 text-right text-xs tabular-nums text-muted">
        {formatPlaybackTime(new Date(toMs).toISOString())}
      </span>
    </div>
  );
}

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { Ref } from "react";
import type { AppError } from "../../../errors/types";
import { ErrorState } from "../../../errors/ErrorState";
import { SlowNotice } from "../../../errors/SlowNotice";
import {
  MISSING,
  formatHeading,
  formatPlaybackTime,
  formatSpeed,
  spansLocalDays,
} from "../../../lib/format";
import { useDelayedFlag } from "../../../lib/useDelayedFlag";
import { IconButton } from "../../../ui/IconButton";
import { Select } from "../../../ui/Select";
import { Skeleton } from "../../../ui/StatePanel";
import { cn } from "../../../ui/cn";
import type { PlaybackEvent } from "../lib/events";
import { gapLabel, type Cursor, type RouteGap } from "../lib/history";
import { MAX_VISIBLE_GAP_LABELS, PLAYBACK_SPEEDS } from "../lib/constants";
import { PlaybackScrubber } from "./PlaybackScrubber";

export interface PlaybackControlsProps {
  fromMs: number;
  toMs: number;
  playheadMs: number;
  playing: boolean;
  speed: number;
  cursor: Cursor;
  pointCount: number;
  gaps: readonly RouteGap[];
  events: readonly PlaybackEvent[];
  loading?: boolean;
  refreshing?: boolean;
  error?: AppError | null;
  disabled?: boolean;
  onToggle: () => void;
  onStep: (direction: -1 | 1) => void;
  onSeek: (timeMs: number) => void;
  onSpeedChange: (speed: number) => void;
  onRetry: () => void;
  onCancel: () => void;
  controlsRef?: Ref<HTMLElement>;
  className?: string;
}

function ControlsSkeleton() {
  return (
    <div data-testid="playback-controls-skeleton" aria-busy="true" className="flex flex-col gap-2">
      <Skeleton className="h-16 w-full md:order-3 md:h-13 md:flex-1" />
      <div className="flex items-center justify-center gap-4 md:contents">
        <div className="order-2 flex items-center gap-2 md:order-1">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
        <Skeleton className="order-2 hidden h-5 w-24 md:order-2 md:block" />
        <Skeleton className="order-3 h-8 w-21 md:order-4 md:w-32" />
      </div>
    </div>
  );
}

export function PlaybackControls({
  fromMs,
  toMs,
  playheadMs,
  playing,
  speed,
  cursor,
  pointCount,
  gaps,
  events,
  loading = false,
  refreshing = false,
  error = null,
  disabled = false,
  onToggle,
  onStep,
  onSeek,
  onSpeedChange,
  onRetry,
  onCancel,
  controlsRef,
  className,
}: PlaybackControlsProps) {
  const inGap = cursor.inGap;
  const unavailable = disabled || pointCount === 0;
  const visibleGaps = gaps.slice(0, MAX_VISIBLE_GAP_LABELS);
  const hiddenGaps = gaps.length - visibleGaps.length;
  const crossDay = spansLocalDays(fromMs, toMs);
  const time = (ms: number) => formatPlaybackTime(new Date(ms).toISOString(), crossDay);
  const formatter = (ms: number) => time(ms).replace(/:\d{2}$/, "");
  const skeletonVisible = useDelayedFlag(loading);

  return (
    <section
      ref={controlsRef}
      aria-label="Playback controls"
      tabIndex={-1}
      className={cn("border-border bg-surface text-text border-t px-3 py-2", className)}
    >
      {loading ? (
        <>
          <div className={skeletonVisible ? undefined : "invisible"}>
            <ControlsSkeleton />
          </div>
          <SlowNotice onRetry={onRetry} onCancel={onCancel} />
        </>
      ) : (
        <>
          {refreshing ? <SlowNotice onRetry={onRetry} onCancel={onCancel} /> : null}
          <div
            data-testid="playback-controls-body"
            className="flex flex-col gap-2 md:flex-row md:items-end md:gap-4"
          >
            <PlaybackScrubber
              fromMs={fromMs}
              toMs={toMs}
              playheadMs={playheadMs}
              gaps={gaps}
              events={events}
              onSeek={onSeek}
              disabled={unavailable}
              includeDate={crossDay}
              className="order-1 w-full md:order-3 md:min-w-0 md:flex-1"
            />
            <div className="order-2 flex flex-nowrap items-center justify-center gap-4 md:contents">
              <fieldset
                aria-label="Transport"
                className="m-0 flex shrink-0 items-center gap-2 border-0 p-0 md:order-1"
              >
                <IconButton
                  size="md"
                  label="Step back one position"
                  onClick={() => onStep(-1)}
                  disabled={unavailable}
                  icon={<SkipBack aria-hidden="true" className="size-4" strokeWidth={1.5} />}
                />
                <IconButton
                  size="md"
                  variant="secondary"
                  label={playing ? "Pause" : "Play"}
                  onClick={onToggle}
                  disabled={unavailable}
                  icon={
                    playing ? (
                      <Pause aria-hidden="true" className="size-4" strokeWidth={1.5} />
                    ) : (
                      <Play aria-hidden="true" className="size-4" strokeWidth={1.5} />
                    )
                  }
                />
                <IconButton
                  size="md"
                  label="Step forward one position"
                  onClick={() => onStep(1)}
                  disabled={unavailable}
                  icon={<SkipForward aria-hidden="true" className="size-4" strokeWidth={1.5} />}
                />
              </fieldset>
              <div
                data-testid="playback-readout"
                className="hidden shrink-0 items-center gap-3 text-sm md:order-2 md:flex"
              >
                <span className="min-w-16 text-right tabular-nums">
                  {formatSpeed(inGap ? null : cursor.speedKph)}
                </span>
                <span className="min-w-14 tabular-nums">
                  {inGap ? MISSING : formatHeading(cursor.headingDeg)}
                </span>
              </div>
              <div className="order-3 shrink-0 md:order-4">
                <Select
                  label="Playback speed"
                  labelPlacement="inline"
                  compact
                  aria-label="Playback speed"
                  value={String(speed)}
                  onChange={(event) => onSpeedChange(Number(event.target.value))}
                  className="w-21 text-xs md:w-32"
                >
                  {PLAYBACK_SPEEDS.map((option) => (
                    <option key={option} value={option}>
                      Speed {option}×
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {error ? <ErrorState error={error} compact onRetry={onRetry} /> : null}

          {gaps.length > 0 ? (
            <div className="text-muted mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {visibleGaps.map((gap) => (
                <span key={`${gap.startMs}-${gap.endMs}`}>{gapLabel(gap, formatter)}</span>
              ))}
              {hiddenGaps > 0 ? <span>{hiddenGaps} more gaps</span> : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

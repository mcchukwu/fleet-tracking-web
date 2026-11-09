import { Maximize2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { Ref } from "react";
import type { AppError } from "../../../errors/types";
import { ErrorState } from "../../../errors/ErrorState";
import { SlowNotice } from "../../../errors/SlowNotice";
import {
  MISSING,
  formatHeading,
  formatPlaybackDuration,
  formatPlaybackTime,
  formatSpeed,
} from "../../../lib/format";
import { Button } from "../../../ui/Button";
import { IconButton } from "../../../ui/IconButton";
import { Select } from "../../../ui/Select";
import { Skeleton } from "../../../ui/StatePanel";
import { cn } from "../../../ui/cn";
import type { PlaybackEvent } from "../lib/events";
import { gapLabel, type Cursor, type RouteGap } from "../lib/history";
import {
  MAX_VISIBLE_GAP_LABELS,
  PLAYBACK_SPEEDS,
  RANGE_PRESETS,
  RESOLUTION_OPTIONS,
  type RangePresetId,
  type ResolutionSetting,
} from "../lib/constants";
import { PlaybackEventsMenu } from "./PlaybackEventsMenu";
import { PlaybackScrubber } from "./PlaybackScrubber";

const resolutionLabels: Record<ResolutionSetting, string> = {
  auto: "Auto",
  raw: "Raw",
  "30s": "30s",
  "5m": "5m",
};

export interface PlaybackControlsProps {
  fromMs: number;
  toMs: number;
  playheadMs: number;
  playing: boolean;
  speed: number;
  cursor: Cursor;
  preset: RangePresetId | null;
  resolution: ResolutionSetting;
  responseResolution: string;
  pointCount: number;
  gaps: readonly RouteGap[];
  events: readonly PlaybackEvent[];
  loading?: boolean;
  error?: AppError | null;
  eventsError?: AppError | null;
  disabled?: boolean;
  onToggle: () => void;
  onStep: (direction: -1 | 1) => void;
  onSeek: (timeMs: number) => void;
  onSpeedChange: (speed: number) => void;
  onPreset: (preset: RangePresetId) => void;
  onCustomRange: () => void;
  onResolution: (resolution: ResolutionSetting) => void;
  onFit: () => void;
  onJump: (timeMs: number) => void;
  onRetry: () => void;
  onCancel: () => void;
  onEventsRetry: () => void;
  controlsRef?: Ref<HTMLElement>;
  className?: string;
}

function ControlsSkeleton() {
  return (
    <div data-testid="playback-controls-skeleton" aria-busy="true" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-8 w-20" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
        <Skeleton className="ml-auto h-3 w-32" />
      </div>
      <Skeleton className="h-4 w-full" />
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
  preset,
  resolution,
  responseResolution,
  pointCount,
  gaps,
  events,
  loading = false,
  error = null,
  eventsError = null,
  disabled = false,
  onToggle,
  onStep,
  onSeek,
  onSpeedChange,
  onPreset,
  onCustomRange,
  onResolution,
  onFit,
  onJump,
  onRetry,
  onCancel,
  onEventsRetry,
  controlsRef,
  className,
}: PlaybackControlsProps) {
  const inGap = cursor.inGap;
  const unavailable = disabled || pointCount === 0;
  const visibleGaps = gaps.slice(0, MAX_VISIBLE_GAP_LABELS);
  const hiddenGaps = gaps.length - visibleGaps.length;
  const formatter = (ms: number) => formatPlaybackTime(new Date(ms).toISOString()).slice(0, 5);

  return (
    <section
      ref={controlsRef}
      aria-label="Playback controls"
      className={cn(
        "rounded-lg border border-border bg-surface p-3 text-text shadow-float",
        className,
      )}
    >
      {loading ? (
        <>
          <ControlsSkeleton />
          <SlowNotice onRetry={onRetry} onCancel={onCancel} />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <Select
              label="Range"
              value={preset ?? "custom"}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "custom") onCustomRange();
                else onPreset(value as RangePresetId);
              }}
              className="w-36"
            >
              {RANGE_PRESETS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </Select>
            <Select
              label="Resolution"
              value={resolution}
              onChange={(event) => onResolution(event.target.value as ResolutionSetting)}
              className="w-28"
            >
              {RESOLUTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {resolutionLabels[option]}
                </option>
              ))}
            </Select>
            <span className="text-xs text-muted">Resolution: {responseResolution}</span>
            <span className="text-xs text-muted">
              {formatPlaybackDuration(toMs - fromMs)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={onFit}
              disabled={unavailable}
              className="ml-auto"
              aria-label="Fit route"
            >
              <Maximize2 aria-hidden="true" className="size-4" strokeWidth={1.5} />
              Fit route
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <IconButton
              size="sm"
              label="Step back one position"
              onClick={() => onStep(-1)}
              disabled={unavailable}
              icon={<SkipBack aria-hidden="true" className="size-4" strokeWidth={1.5} />}
            />
            <IconButton
              size="sm"
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
              size="sm"
              label="Step forward one position"
              onClick={() => onStep(1)}
              disabled={unavailable}
              icon={<SkipForward aria-hidden="true" className="size-4" strokeWidth={1.5} />}
            />
            <Select
              label="Speed"
              value={String(speed)}
              onChange={(event) => onSpeedChange(Number(event.target.value))}
              className="ml-2 w-20"
            >
              {PLAYBACK_SPEEDS.map((option) => (
                <option key={option} value={option}>
                  {option}×
                </option>
              ))}
            </Select>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="tabular-nums">{formatSpeed(inGap ? null : cursor.speedKph)}</span>
              <span className="tabular-nums">
                {inGap ? MISSING : formatHeading(cursor.headingDeg)}
              </span>
              <span className="text-xs tabular-nums text-muted">{pointCount} points</span>
            </div>
            <PlaybackEventsMenu events={events} onJump={onJump} />
          </div>

          {error ? (
            <div className="rounded-md border border-border bg-surface-2">
              <ErrorState error={error} compact onRetry={onRetry} />
            </div>
          ) : null}

          {eventsError ? (
            <div className="flex items-center justify-between gap-2 text-xs text-muted">
              <span>
                {eventsError.kind === "forbidden"
                  ? "You don't have access to events"
                  : "Events unavailable"}
              </span>
              {eventsError.kind === "forbidden" ? null : (
                <Button size="sm" variant="ghost" onClick={onEventsRetry}>
                  Retry
                </Button>
              )}
            </div>
          ) : null}

          <PlaybackScrubber
            fromMs={fromMs}
            toMs={toMs}
            playheadMs={playheadMs}
            gaps={gaps}
            events={events}
            onSeek={onSeek}
            disabled={unavailable}
          />

          {gaps.length > 0 ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              {visibleGaps.map((gap) => (
                <span key={`${gap.startMs}-${gap.endMs}`}>{gapLabel(gap, formatter)}</span>
              ))}
              {hiddenGaps > 0 ? <span>{hiddenGaps} more gaps</span> : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

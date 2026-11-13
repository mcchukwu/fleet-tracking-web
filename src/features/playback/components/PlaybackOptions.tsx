import { ArrowLeft, ChevronDown, Maximize2 } from "lucide-react";
import type { Ref } from "react";
import { Link } from "@tanstack/react-router";
import type { SnapshotVehicle } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import { MISSING, formatClockTime, formatHeading, formatSpeed } from "../../../lib/format";
import type { Cursor } from "../lib/history";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { Select } from "../../../ui/Select";
import { Tooltip } from "../../../ui/Tooltip";
import { cn } from "../../../ui/cn";
import { RESOLUTION_OPTIONS, type RangePresetId, type ResolutionSetting } from "../lib/constants";
import type { PlaybackEvent } from "../lib/events";
import { PlaybackEventsMenu } from "./PlaybackEventsMenu";
import { PlaybackRangeMenu } from "./PlaybackRangeMenu";

const resolutionLabels: Record<ResolutionSetting, string> = {
  auto: "Auto",
  raw: "Raw",
  "30s": "30s",
  "5m": "5m",
};

export interface PlaybackOptionsProps {
  vehicle: Pick<SnapshotVehicle, "id" | "plate">;
  offline: boolean;
  savedAt?: number | null;
  preset: RangePresetId | null;
  resolution: ResolutionSetting;
  responseResolution: string | null;
  pointCount: number;
  cursor: Cursor;
  events: readonly PlaybackEvent[];
  includeDate: boolean;
  eventsError?: AppError | null;
  onPreset: (preset: RangePresetId) => void;
  onCustomRange: () => void;
  onResolution: (resolution: ResolutionSetting) => void;
  onFit: () => void;
  onJump: (timeMs: number) => void;
  onEventsRetry: () => void;
  onChangeVehicle: () => void;
  changeTriggerRef?: Ref<HTMLButtonElement>;
  rangeTriggerRef?: Ref<HTMLButtonElement>;
  className?: string;
}

export function PlaybackOptions({
  vehicle,
  offline,
  savedAt,
  preset,
  resolution,
  responseResolution,
  pointCount,
  cursor,
  events,
  includeDate,
  eventsError = null,
  onPreset,
  onCustomRange,
  onResolution,
  onFit,
  onJump,
  onEventsRetry,
  onChangeVehicle,
  changeTriggerRef,
  rangeTriggerRef,
  className,
}: PlaybackOptionsProps) {
  const unavailable = pointCount === 0;
  const eventsDisabledReason = eventsError
    ? eventsError.kind === "forbidden"
      ? "You don't have access to events"
      : "Events unavailable"
    : undefined;
  const offlineLabel = savedAt
    ? `Offline · showing data from ${formatClockTime(savedAt)}`
    : "Offline · showing saved data";

  return (
    <header
      data-testid="playback-options"
      className={cn("bg-surface shadow-float ring-border rounded-lg ring-1", className)}
    >
      <h1 className="sr-only">Playback</h1>
      <div className="flex min-w-0 items-center gap-2 py-2">
        <Link
          to="/map"
          search={{ v: vehicle.id }}
          aria-label="Back to map"
          className="size-touch text-muted hover:text-text focus-visible:outline-focus-ring md:size-control-md inline-flex shrink-0 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-0"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            ref={changeTriggerRef}
            size="md"
            variant="ghost"
            aria-label={`Change vehicle, ${vehicle.plate}`}
            onClick={onChangeVehicle}
            className="min-w-0 justify-start gap-1 px-2"
          >
            <span className="truncate font-mono">{vehicle.plate}</span>
            <ChevronDown
              aria-hidden="true"
              className="text-subtle size-4 shrink-0"
              strokeWidth={1.5}
            />
          </Button>
          <PlaybackRangeMenu
            preset={preset}
            onPreset={onPreset}
            onCustomRange={onCustomRange}
            triggerRef={rangeTriggerRef}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PlaybackEventsMenu
            events={events}
            onJump={onJump}
            includeDate={includeDate}
            disabledReason={eventsDisabledReason}
          />
          <Tooltip label="Fit route">
            <Button
              size="md"
              variant="ghost"
              onClick={onFit}
              disabled={unavailable}
              aria-label="Fit route"
              className="w-touch justify-center px-0 md:w-auto md:px-3"
            >
              <Maximize2 aria-hidden="true" className="size-4" strokeWidth={1.5} />
              <span className="hidden md:inline">Fit route</span>
            </Button>
          </Tooltip>
        </div>
      </div>

      <div
        data-testid="playback-options-info"
        className="text-muted flex min-w-0 items-center gap-2 px-3 pb-2 text-xs"
      >
        <Select
          label="Resolution"
          labelPlacement="inline"
          compact
          value={resolution}
          onChange={(event) => onResolution(event.target.value as ResolutionSetting)}
          className="w-20 shrink-0 text-xs"
        >
          {RESOLUTION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {resolutionLabels[option]}
            </option>
          ))}
        </Select>
        <span data-testid="playback-options-info-text" className="min-w-0 flex-1 truncate">
          Resolution: {responseResolution ?? MISSING} · {pointCount} points
          <span className="md:hidden">
            {" · "}
            {formatSpeed(cursor.inGap ? null : cursor.speedKph)}
            {" · "}
            {cursor.inGap ? MISSING : formatHeading(cursor.headingDeg)}
          </span>
        </span>
        {offline ? (
          <Badge tone="neutral" className="max-w-40 min-w-0 shrink overflow-hidden">
            <span className="truncate">{offlineLabel}</span>
          </Badge>
        ) : null}
        {eventsError ? (
          <span className="flex shrink-0 items-center gap-1">
            <span>Events unavailable</span>
            {eventsError.kind === "forbidden" ? null : (
              <Button size="md" variant="ghost" onClick={onEventsRetry} className="shrink-0">
                Retry
              </Button>
            )}
          </span>
        ) : null}
      </div>
    </header>
  );
}

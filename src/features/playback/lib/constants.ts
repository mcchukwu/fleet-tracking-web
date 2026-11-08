export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const DEFAULT_RANGE_MS = 2 * HOUR_MS;
export const MAX_RANGE_MS = 7 * DAY_MS;

export const RANGE_PRESETS = [
  { id: "30m", label: "Last 30 minutes", ms: 30 * MINUTE_MS },
  { id: "2h", label: "Last 2 hours", ms: 2 * HOUR_MS },
  { id: "6h", label: "Last 6 hours", ms: 6 * HOUR_MS },
  { id: "24h", label: "Last 24 hours", ms: 24 * HOUR_MS },
] as const;

export type RangePresetId = (typeof RANGE_PRESETS)[number]["id"];

export const RESOLUTION_OPTIONS = ["auto", "raw", "30s", "5m"] as const;
export type ResolutionSetting = (typeof RESOLUTION_OPTIONS)[number];
export const DEFAULT_RESOLUTION: ResolutionSetting = "30s";

export const PLAYBACK_SPEEDS = [1, 2, 4, 8, 16] as const;
export const DEFAULT_SPEED = 1;

export const GAP_FACTOR = 3;
export const MIN_GAP_MS = MINUTE_MS;

export const CLOCK_COMMIT_MS = 50;
export const MAX_FRAME_DELTA_MS = 250;
export const PRESET_MATCH_TOLERANCE_MS = 60 * SECOND_MS;
export const MAX_VISIBLE_GAP_LABELS = 3;

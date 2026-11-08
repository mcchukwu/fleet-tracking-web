import {
  DEFAULT_RANGE_MS,
  MAX_RANGE_MS,
  PRESET_MATCH_TOLERANCE_MS,
  RANGE_PRESETS,
  type RangePresetId,
  type ResolutionSetting,
} from "./constants";

export interface PlaybackRange {
  from: string;
  to: string;
}

export type RangeValidation =
  | { valid: true; fromMs: number; toMs: number }
  | {
      valid: false;
      reason: "missing" | "invalid" | "order" | "too_long";
      message: string;
    };

const missingMessage = "Choose a start and end time.";
const orderMessage = "The end time must be after the start time.";
const tooLongMessage = "Choose a range of 7 days or less.";

export function defaultRange(now = Date.now()): PlaybackRange {
  return {
    from: new Date(now - DEFAULT_RANGE_MS).toISOString(),
    to: new Date(now).toISOString(),
  };
}

export function presetRange(ms: number, now = Date.now()): PlaybackRange {
  return { from: new Date(now - ms).toISOString(), to: new Date(now).toISOString() };
}

function parse(value: string | undefined | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function validateRange(from?: string, to?: string): RangeValidation {
  const fromMs = parse(from);
  const toMs = parse(to);
  if (fromMs === null || toMs === null) {
    const missing = !from || !to;
    return { valid: false, reason: missing ? "missing" : "invalid", message: missingMessage };
  }
  if (toMs <= fromMs) return { valid: false, reason: "order", message: orderMessage };
  if (toMs - fromMs > MAX_RANGE_MS) {
    return { valid: false, reason: "too_long", message: tooLongMessage };
  }
  return { valid: true, fromMs, toMs };
}

export function activePreset(
  from: string,
  to: string,
  now = Date.now(),
): RangePresetId | null {
  const validation = validateRange(from, to);
  if (!validation.valid) return null;
  if (Math.abs(now - validation.toMs) > PRESET_MATCH_TOLERANCE_MS) return null;
  const duration = validation.toMs - validation.fromMs;
  const match = RANGE_PRESETS.find(
    (preset) => Math.abs(preset.ms - duration) <= PRESET_MATCH_TOLERANCE_MS,
  );
  return match?.id ?? null;
}

export function resolutionParam(setting: ResolutionSetting): ResolutionSetting | undefined {
  return setting === "auto" ? undefined : setting;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

export function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** A datetime-local value is local wall time; the API receives the UTC instant. */
export function fromLocalInputValue(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );
  // A DST gap rolls the clock forward; reject a value the browser could not keep.
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hour) ||
    date.getMinutes() !== Number(minute)
  ) {
    return null;
  }
  return date.toISOString();
}

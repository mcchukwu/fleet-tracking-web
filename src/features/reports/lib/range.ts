import { validateDatetimeRange, type DatetimeRangeValidation } from "../../../lib/datetime";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export interface ReportsRange {
  from: string;
  to: string;
}

export const REPORT_PRESETS = [
  { id: "24h", label: "24 hours", ms: 24 * HOUR_MS },
  { id: "7d", label: "7 days", ms: 7 * DAY_MS },
  { id: "30d", label: "30 days", ms: 30 * DAY_MS },
] as const;

export type ReportPresetId = (typeof REPORT_PRESETS)[number]["id"];

export const DEFAULT_REPORT_RANGE_MS = 7 * DAY_MS;
export const PRESET_MATCH_TOLERANCE_MS = MINUTE_MS;

export function defaultReportsRange(now = Date.now()): ReportsRange {
  return {
    from: new Date(now - DEFAULT_REPORT_RANGE_MS).toISOString(),
    to: new Date(now).toISOString(),
  };
}

export function presetReportsRange(ms: number, now = Date.now()): ReportsRange {
  return { from: new Date(now - ms).toISOString(), to: new Date(now).toISOString() };
}

/** Order and format only; the API enforces no maximum range. */
export function validateReportsRange(
  from?: string,
  to?: string,
): DatetimeRangeValidation {
  return validateDatetimeRange(from, to);
}

/**
 * Derived from the duration alone, so a shared link keeps its label as time
 * passes. A custom range that happens to match a preset duration reads as that
 * preset, which is truthful: the duration is what the label names.
 */
export function activeReportsPreset(
  from?: string,
  to?: string,
): ReportPresetId | null {
  const validation = validateReportsRange(from, to);
  if (!validation.valid) return null;
  const duration = validation.toMs - validation.fromMs;
  const match = REPORT_PRESETS.find(
    (preset) => Math.abs(preset.ms - duration) <= PRESET_MATCH_TOLERANCE_MS,
  );
  return match?.id ?? null;
}

export function reportPresetLabel(preset: ReportPresetId | null): string {
  if (!preset) return "Custom";
  return REPORT_PRESETS.find((option) => option.id === preset)?.label ?? "Custom";
}

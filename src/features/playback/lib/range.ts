import type { HistoryResolution } from "../../../api/types";
import { validateDatetimeRange, type DatetimeRangeValidation } from "../../../lib/datetime";
import {
  DEFAULT_RANGE_MS,
  MAX_RANGE_MS,
  PRESET_MATCH_TOLERANCE_MS,
  RANGE_PRESETS,
  type RangePresetId,
  type ResolutionSetting,
} from "./constants";

export { fromLocalInputValue, toLocalInputValue } from "../../../lib/datetime";

export interface PlaybackRange {
  from: string;
  to: string;
}

export type RangeValidation = DatetimeRangeValidation;

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

export function validateRange(from?: string, to?: string): RangeValidation {
  const validation = validateDatetimeRange(from, to);
  if (!validation.valid) return validation;
  if (validation.toMs - validation.fromMs > MAX_RANGE_MS) {
    return { valid: false, reason: "too_long", message: tooLongMessage, field: "both" };
  }
  return validation;
}

export function activePreset(from: string, to: string, now = Date.now()): RangePresetId | null {
  const validation = validateRange(from, to);
  if (!validation.valid) return null;
  if (Math.abs(now - validation.toMs) > PRESET_MATCH_TOLERANCE_MS) return null;
  const duration = validation.toMs - validation.fromMs;
  const match = RANGE_PRESETS.find(
    (preset) => Math.abs(preset.ms - duration) <= PRESET_MATCH_TOLERANCE_MS,
  );
  return match?.id ?? null;
}

export function resolutionParam(setting: ResolutionSetting): HistoryResolution | undefined {
  return setting === "auto" ? undefined : setting;
}

import { describe, expect, it } from "vitest";
import {
  DEFAULT_REPORT_RANGE_MS,
  REPORT_PRESETS,
  activeReportsPreset,
  defaultReportsRange,
  presetReportsRange,
  reportPresetLabel,
  validateReportsRange,
} from "./range";

const DAY = 86_400_000;
const now = Date.parse("2026-11-08T12:00:00Z");

describe("report range defaults", () => {
  it("defaults to exactly seven days ending now, written in UTC", () => {
    expect(defaultReportsRange(now)).toEqual({
      from: "2026-11-01T12:00:00.000Z",
      to: "2026-11-08T12:00:00.000Z",
    });
    expect(DEFAULT_REPORT_RANGE_MS).toBe(7 * DAY);
  });

  it("builds every preset backwards from now", () => {
    const thirty = REPORT_PRESETS.find((preset) => preset.id === "30d");
    expect(thirty).toBeDefined();
    expect(presetReportsRange(thirty?.ms ?? 0, now)).toEqual({
      from: "2026-10-09T12:00:00.000Z",
      to: "2026-11-08T12:00:00.000Z",
    });
  });
});

describe("validateReportsRange", () => {
  it("accepts a strict ordered range", () => {
    expect(validateReportsRange("2026-11-01T12:00:00Z", "2026-11-08T12:00:00Z")).toMatchObject({
      valid: true,
    });
  });

  it("rejects a date-only value instead of letting the server substitute one", () => {
    expect(validateReportsRange("2026-11-01", "2026-11-08T12:00:00Z")).toMatchObject({
      valid: false,
      reason: "invalid",
    });
  });

  it("rejects reversed, equal and missing ranges", () => {
    expect(validateReportsRange("2026-11-08T12:00:00Z", "2026-11-01T12:00:00Z")).toMatchObject({
      valid: false,
      reason: "order",
    });
    expect(validateReportsRange("2026-11-08T12:00:00Z", "2026-11-08T12:00:00Z")).toMatchObject({
      valid: false,
      reason: "order",
    });
    expect(validateReportsRange(undefined, "2026-11-08T12:00:00Z")).toMatchObject({
      valid: false,
      reason: "missing",
    });
  });

  it("accepts a long range because the API enforces no maximum", () => {
    expect(validateReportsRange("2025-11-08T12:00:00Z", "2026-11-08T12:00:00Z")).toMatchObject({
      valid: true,
    });
  });
});

describe("activeReportsPreset", () => {
  it("matches a duration within the tolerance", () => {
    expect(activeReportsPreset("2026-11-01T12:00:10Z", "2026-11-08T12:00:00Z")).toBe("7d");
    expect(activeReportsPreset("2026-11-07T12:00:00Z", "2026-11-08T12:00:00Z")).toBe("24h");
    expect(activeReportsPreset("2026-10-09T12:00:00Z", "2026-11-08T12:00:00Z")).toBe("30d");
  });

  it("does not relabel a shared range as a preset because time passed", () => {
    expect(activeReportsPreset("2026-10-01T12:00:00Z", "2026-10-08T12:00:00Z")).toBe("7d");
  });

  it("returns null for a custom duration or an invalid range", () => {
    expect(activeReportsPreset("2026-11-01T12:00:00Z", "2026-11-05T12:00:00Z")).toBeNull();
    expect(activeReportsPreset("2026-11-08T12:00:00Z", "2026-11-01T12:00:00Z")).toBeNull();
  });

  it("labels every preset", () => {
    expect(reportPresetLabel("24h")).toBe("24 hours");
    expect(reportPresetLabel("7d")).toBe("7 days");
    expect(reportPresetLabel("30d")).toBe("30 days");
    expect(reportPresetLabel(null)).toBe("Custom");
  });
});

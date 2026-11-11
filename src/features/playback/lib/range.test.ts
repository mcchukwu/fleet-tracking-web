import { describe, expect, it } from "vitest";
import {
  activePreset,
  defaultRange,
  presetRange,
  resolutionParam,
  validateRange,
} from "./range";
import { RANGE_PRESETS } from "./constants";

const now = Date.parse("2026-11-08T12:00:00Z");

describe("defaults and presets", () => {
  it("defaults to the last two hours, written in UTC", () => {
    expect(defaultRange(now)).toEqual({
      from: "2026-11-08T10:00:00.000Z",
      to: "2026-11-08T12:00:00.000Z",
    });
  });

  it("builds every preset backwards from now", () => {
    const thirty = RANGE_PRESETS.find((preset) => preset.id === "30m");
    expect(thirty).toBeDefined();
    expect(presetRange(thirty?.ms ?? 0, now)).toEqual({
      from: "2026-11-08T11:30:00.000Z",
      to: "2026-11-08T12:00:00.000Z",
    });
  });
});

describe("validateRange", () => {
  it("accepts a parseable range and returns both UTC instants", () => {
    const result = validateRange("2026-11-08T10:00:00Z", "2026-11-08T12:00:00Z");
    expect(result).toMatchObject({ valid: true });
    if (!result.valid) return;
    expect(result.fromMs).toBe(Date.parse("2026-11-08T10:00:00Z"));
    expect(result.toMs).toBe(Date.parse("2026-11-08T12:00:00Z"));
  });

  it("rejects missing ends", () => {
    expect(validateRange(undefined, "2026-11-08T12:00:00Z")).toMatchObject({
      valid: false,
      reason: "missing",
    });
  });

  it("rejects unparseable ends", () => {
    expect(validateRange("not-a-date", "2026-11-08T12:00:00Z")).toMatchObject({
      valid: false,
      reason: "invalid",
    });
  });

  it("rejects an end that is not after the start", () => {
    expect(validateRange("2026-11-08T12:00:00Z", "2026-11-08T12:00:00Z")).toMatchObject({
      valid: false,
      reason: "order",
      message: "The end time must be after the start time.",
    });
  });

  it("accepts exactly seven days and rejects one second more", () => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const from = now - sevenDays;
    expect(validateRange(new Date(from).toISOString(), new Date(now).toISOString())).toMatchObject({
      valid: true,
    });
    expect(
      validateRange(new Date(from - 1000).toISOString(), new Date(now).toISOString()),
    ).toMatchObject({
      valid: false,
      reason: "too_long",
      message: "Choose a range of 7 days or less.",
    });
  });
});

describe("activePreset", () => {
  it("matches a duration that ends close to now", () => {
    expect(activePreset("2026-11-08T10:00:00Z", "2026-11-08T12:00:00Z", now)).toBe("2h");
  });

  it("does not match when the range no longer ends near now", () => {
    expect(activePreset("2026-11-08T09:40:00Z", "2026-11-08T11:40:00Z", now)).toBeNull();
  });

  it("does not match a duration that is not a preset", () => {
    expect(activePreset("2026-11-08T09:00:00Z", "2026-11-08T12:00:00Z", now)).toBeNull();
  });
});

describe("resolution", () => {
  it("omits the parameter for Auto and passes fixed values", () => {
    expect(resolutionParam("auto")).toBeUndefined();
    expect(resolutionParam("raw")).toBe("raw");
    expect(resolutionParam("5m")).toBe("5m");
  });
});

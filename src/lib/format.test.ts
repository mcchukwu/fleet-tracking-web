import { describe, expect, it } from "vitest";
import {
  MISSING,
  formatAgeSeconds,
  formatCoordinates,
  formatCount,
  formatDistance,
  formatHeading,
  formatPlaybackDuration,
  formatPlaybackRange,
  formatPlaybackTime,
  formatRelativeTime,
  formatSpeed,
  formatTimeTooltip,
  spansLocalDays,
} from "./format";

const now = Date.parse("2026-11-03T12:00:00Z");

describe("format", () => {
  it("uses an em dash for every missing value", () => {
    expect(formatSpeed(undefined)).toBe(MISSING);
    expect(formatDistance(null)).toBe(MISSING);
    expect(formatHeading(undefined)).toBe(MISSING);
    expect(formatCoordinates(undefined, 3.4)).toBe(MISSING);
  });

  it("formats speed as an integer with its unit", () => {
    expect(formatSpeed(61.6)).toBe("62 km/h");
    expect(formatSpeed(0)).toBe("0 km/h");
  });

  it("formats distance with one decimal under 100 km", () => {
    expect(formatDistance(12.44)).toBe("12.4 km");
    expect(formatDistance(100.4)).toBe("100 km");
    expect(formatDistance(0)).toBe("0.0 km");
  });

  it("formats heading with a compass point", () => {
    expect(formatHeading(272)).toBe("272° W");
    expect(formatHeading(0)).toBe("0° N");
    expect(formatHeading(359.6)).toBe("0° N");
    expect(formatHeading(92)).toBe("92° E");
  });

  it("formats coordinates to five decimals", () => {
    expect(formatCoordinates(6.524379, 3.379206)).toBe("6.52438, 3.37921");
  });

  it("formats counts with thousands separators", () => {
    expect(formatCount(1234)).toBe("1,234");
    expect(formatCount(undefined)).toBe(MISSING);
  });

  it("formats fresh relative ages", () => {
    expect(formatRelativeTime("2026-11-03T11:59:58Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-11-03T11:59:30Z", now)).toBe("30s ago");
    expect(formatRelativeTime("2026-11-03T11:57:00Z", now)).toBe("3m ago");
    expect(formatRelativeTime("2026-11-03T09:00:00Z", now)).toBe("3h ago");
  });

  it("falls back to an absolute timestamp after 24 hours", () => {
    expect(formatRelativeTime("2026-11-01T14:02:00Z", now, "UTC")).toBe("1 Nov, 14:02");
  });

  it("shows local and UTC in the tooltip", () => {
    expect(formatTimeTooltip("2026-11-02T14:02:00Z", "UTC")).toContain("UTC");
    expect(formatTimeTooltip("2026-11-02T14:02:00Z", "UTC")).toContain("2 Nov 2026, 14:02");
  });

  it("formats compact data ages", () => {
    expect(formatAgeSeconds(4)).toBe("4s");
    expect(formatAgeSeconds(125)).toBe("2m");
    expect(formatAgeSeconds(7_200)).toBe("2h");
    expect(formatAgeSeconds(null)).toBe(MISSING);
  });
});

describe("playback formatting", () => {
  const iso = (y: number, m: number, d: number, h: number, min: number, s = 0) =>
    new Date(y, m - 1, d, h, min, s).toISOString();

  it("shows seconds and an optional date prefix", () => {
    expect(formatPlaybackTime(iso(2026, 11, 8, 14, 30, 5))).toBe("14:30:05");
    expect(formatPlaybackTime(iso(2026, 11, 8, 14, 30, 5), true)).toBe("8 Nov 14:30:05");
  });

  it("returns the missing value for an invalid instant", () => {
    expect(formatPlaybackTime("not-a-date")).toBe(MISSING);
  });

  it("formats a same-day range once and a cross-day range with both dates", () => {
    expect(
      formatPlaybackRange(iso(2026, 11, 8, 14, 0), iso(2026, 11, 8, 16, 0)),
    ).toBe("14:00 – 16:00");
    expect(
      formatPlaybackRange(iso(2026, 11, 8, 22, 0), iso(2026, 11, 9, 2, 0)),
    ).toBe("8 Nov 22:00 – 9 Nov 02:00");
  });

  it("detects a range that crosses local midnight", () => {
    expect(
      spansLocalDays(
        Date.parse(iso(2026, 11, 8, 14, 0)),
        Date.parse(iso(2026, 11, 8, 16, 0)),
      ),
    ).toBe(false);
    expect(
      spansLocalDays(
        Date.parse(iso(2026, 11, 8, 22, 0)),
        Date.parse(iso(2026, 11, 9, 2, 0)),
      ),
    ).toBe(true);
  });

  it("formats durations in hours, minutes and days", () => {
    expect(formatPlaybackDuration(30 * 60_000)).toBe("30m");
    expect(formatPlaybackDuration(2 * 3_600_000)).toBe("2h");
    expect(formatPlaybackDuration(90 * 60_000)).toBe("1h 30m");
    expect(formatPlaybackDuration(7 * 86_400_000)).toBe("7d");
    expect(formatPlaybackDuration(-1)).toBe(MISSING);
  });
});

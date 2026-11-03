import { describe, expect, it } from "vitest";
import {
  MISSING,
  formatAgeSeconds,
  formatCoordinates,
  formatCount,
  formatDistance,
  formatHeading,
  formatRelativeTime,
  formatSpeed,
  formatTimeTooltip,
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

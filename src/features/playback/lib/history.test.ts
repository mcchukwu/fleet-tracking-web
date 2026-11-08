import { describe, expect, it } from "vitest";
import {
  cursorAt,
  findGaps,
  gapLabel,
  indexAtTime,
  medianInterval,
  normalisePoints,
} from "./history";
import type { Point } from "../../../api/types";

function point(second: number, lat = 6.5, lon = 3.4): Point {
  return {
    t: new Date(Date.UTC(2026, 10, 8, 10, 0, second)).toISOString(),
    lat,
    lon,
    speed_kph: 40 + second,
    heading_deg: 90,
  };
}

describe("normalisePoints", () => {
  it("sorts ascending and keeps the last duplicate timestamp", () => {
    const later = point(30, 6.6, 3.5);
    const earlier = point(0, 6.4, 3.3);
    const duplicate = point(30, 6.7, 3.6);
    expect(normalisePoints([later, earlier, duplicate])).toEqual([earlier, duplicate]);
  });
});

describe("medianInterval", () => {
  it("returns the median gap of a regular series", () => {
    const points = [point(0), point(30), point(60), point(90)];
    expect(medianInterval(points)).toBe(30_000);
  });

  it("returns null for fewer than two points", () => {
    expect(medianInterval([point(0)])).toBeNull();
  });
});

describe("findGaps", () => {
  it("flags nothing in a regular series", () => {
    const points = [point(0), point(30), point(60)];
    expect(findGaps(points)).toEqual({ gapAfterIndex: [], gaps: [] });
  });

  it("does not flag ordinary bucketing jitter", () => {
    const points = [point(0), point(30), point(65), point(95)];
    expect(findGaps(points).gapAfterIndex).toEqual([]);
  });

  it("flags a twelve-minute gap between thirty-second points", () => {
    const points = [point(0), point(30), point(30 + 12 * 60), point(30 + 12 * 60 + 30)];
    const result = findGaps(points);
    expect(result.gapAfterIndex).toEqual([1]);
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0]).toMatchObject({ startIndex: 1, startMs: Date.parse(points[1]!.t) });
  });

  it("flags a sixty-second gap in a one-second series", () => {
    const points = [
      { ...point(0), t: "2026-11-08T10:00:00Z" },
      { ...point(1), t: "2026-11-08T10:00:01Z" },
      { ...point(2), t: "2026-11-08T10:00:02Z" },
      { ...point(3), t: "2026-11-08T10:01:02Z" },
    ];
    expect(findGaps(points).gapAfterIndex).toEqual([2]);
  });
});

describe("indexAtTime", () => {
  const points = [point(0), point(30), point(60)];

  it("finds the last point at or before a time", () => {
    expect(indexAtTime(points, Date.parse(points[1]!.t) + 1)).toBe(1);
  });

  it("clamps before the first and after the last point", () => {
    expect(indexAtTime(points, 0)).toBe(0);
    expect(indexAtTime(points, Date.parse("2026-11-08T11:00:00Z"))).toBe(2);
  });
});

describe("cursorAt", () => {
  const points = [point(0, 6.5, 3.4), point(30, 6.6, 3.5), point(60, 6.7, 3.6)];

  it("interpolates between two points", () => {
    const cursor = cursorAt(points, Date.parse(points[0]!.t) + 15_000, [], false);
    expect(cursor.position?.[0]).toBeCloseTo(3.45, 6);
    expect(cursor.position?.[1]).toBeCloseTo(6.55, 6);
    expect(cursor.index).toBe(0);
    expect(cursor.inGap).toBe(false);
  });

  it("snaps to the current point under reduced motion", () => {
    const cursor = cursorAt(points, Date.parse(points[0]!.t) + 15_000, [], true);
    expect(cursor.position).toEqual([3.4, 6.5]);
  });

  it("never interpolates across a gap", () => {
    const cursor = cursorAt(points, Date.parse(points[0]!.t) + 15_000, [0], false);
    expect(cursor.position).toEqual([3.4, 6.5]);
    expect(cursor.inGap).toBe(true);
    expect(cursor.speedKph).toBeNull();
    expect(cursor.headingDeg).toBeNull();
  });

  it("handles a single point and an empty route", () => {
    expect(cursorAt([points[0]!], Date.parse(points[0]!.t), [], false)).toMatchObject({
      index: 0,
      position: [3.4, 6.5],
    });
    expect(cursorAt([], 0, [], false)).toEqual({
      index: -1,
      position: null,
      inGap: false,
      speedKph: null,
      headingDeg: null,
    });
  });
});

describe("gapLabel", () => {
  it("names both ends with the supplied clock formatter", () => {
    const gaps = findGaps([
      { ...point(0), t: "2026-11-08T14:09:00Z" },
      { ...point(0), t: "2026-11-08T14:09:30Z" },
      { ...point(0), t: "2026-11-08T14:10:00Z" },
      { ...point(0), t: "2026-11-08T14:25:00Z" },
    ]).gaps;
    expect(gapLabel(gaps[0]!, (ms) => new Date(ms).toISOString().slice(11, 16))).toBe(
      "No data 14:10 to 14:25",
    );
  });
});

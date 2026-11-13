import { describe, expect, it } from "vitest";
import { routeBounds, routeLineCollection, routePointCollection, routeRuns } from "./route";
import type { LngLat } from "./types";

const points: LngLat[] = [
  [3.3, 6.5],
  [3.4, 6.6],
  [3.5, 6.7],
  [3.6, 6.8],
];

function lineFeatures(collection: ReturnType<typeof routeLineCollection>) {
  return collection.features.map((feature) => ({
    coordinates: feature.geometry.coordinates,
    gap: feature.properties?.gap,
  }));
}

describe("routeBounds", () => {
  it("wraps every point in south/west/north/east", () => {
    expect(routeBounds(points)).toEqual({ south: 6.5, west: 3.3, north: 6.8, east: 3.6 });
  });

  it("returns null without points", () => {
    expect(routeBounds([])).toBeNull();
  });

  it("handles a single point", () => {
    expect(routeBounds([[3.3, 6.5]])).toEqual({
      south: 6.5,
      west: 3.3,
      north: 6.5,
      east: 3.3,
    });
  });
});

describe("routeRuns", () => {
  it("returns one run for a gap-free route", () => {
    expect(routeRuns(points, [])).toEqual([points]);
  });

  it("splits a run after a gap and keeps every point once", () => {
    expect(routeRuns(points, [1])).toEqual([
      [points[0], points[1]],
      [points[2], points[3]],
    ]);
  });

  it("ignores out-of-range gap indexes", () => {
    expect(routeRuns(points, [-1, 99])).toEqual([points]);
  });
});

describe("routeLineCollection", () => {
  it("draws solid runs and a dashed connector for each gap", () => {
    expect(lineFeatures(routeLineCollection(points, [1]))).toEqual([
      { coordinates: [points[0], points[1]], gap: false },
      { coordinates: [points[1], points[2]], gap: true },
      { coordinates: [points[2], points[3]], gap: false },
    ]);
  });

  it("draws nothing for fewer than two points", () => {
    expect(routeLineCollection([], []).features).toEqual([]);
    expect(routeLineCollection([[3.3, 6.5]], []).features).toEqual([]);
  });

  it("uses the run geometry, so a solid run is one feature", () => {
    const features = routeLineCollection(points, []).features;
    expect(features).toHaveLength(1);
    expect(features[0]?.geometry.coordinates).toHaveLength(4);
  });
});

describe("routePointCollection", () => {
  it("marks the start, end and prepared cursor position", () => {
    const collection = routePointCollection(points, [3.45, 6.65]);
    expect(collection.features.map((feature) => feature.properties?.role)).toEqual([
      "start",
      "end",
      "cursor",
    ]);
    expect(collection.features[2]?.geometry.coordinates).toEqual([3.45, 6.65]);
  });

  it("omits the cursor when the route has none", () => {
    expect(routePointCollection(points, null).features.map((f) => f.properties?.role)).toEqual([
      "start",
      "end",
    ]);
  });

  it("keeps a start and end pin for a single point", () => {
    const collection = routePointCollection([[3.3, 6.5]], null);
    expect(collection.features).toHaveLength(2);
    expect(collection.features[0]?.geometry.coordinates).toEqual([3.3, 6.5]);
    expect(collection.features[1]?.geometry.coordinates).toEqual([3.3, 6.5]);
  });

  it("returns nothing without points", () => {
    expect(routePointCollection([], [3.4, 6.6]).features).toEqual([]);
  });
});

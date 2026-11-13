import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { Bounds, LngLat } from "./types";

export type RoutePointRole = "start" | "end" | "cursor";

export interface RouteLineProperties {
  gap: boolean;
}

export interface RoutePointProperties {
  role: RoutePointRole;
}

export function routeBounds(points: readonly LngLat[]): Bounds | null {
  let south = Number.POSITIVE_INFINITY;
  let west = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  for (const [lon, lat] of points) {
    if (lat < south) south = lat;
    if (lon < west) west = lon;
    if (lat > north) north = lat;
    if (lon > east) east = lon;
  }
  if (!Number.isFinite(south) || !Number.isFinite(west)) return null;
  return { south, west, north, east };
}

function validGapIndexes(gapAfterIndex: readonly number[], length: number): Set<number> {
  return new Set(
    gapAfterIndex.filter((index) => Number.isInteger(index) && index >= 0 && index < length - 1),
  );
}

/**
 * Split the route into contiguous solid runs. A gap always breaks the run: the
 * connector itself is drawn separately and dashed, never as a line run.
 */
export function routeRuns(points: readonly LngLat[], gapAfterIndex: readonly number[]): LngLat[][] {
  if (points.length < 2) return [];
  const gaps = validGapIndexes(gapAfterIndex, points.length);
  const runs: LngLat[][] = [];
  let current: LngLat[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!point) continue;
    current.push(point);
    const isGap = gaps.has(index);
    const isLast = index === points.length - 1;
    if (isLast || isGap) {
      if (current.length >= 2) runs.push(current);
      current = [];
    }
  }
  return runs;
}

export function routeLineCollection(
  points: readonly LngLat[],
  gapAfterIndex: readonly number[],
): FeatureCollection<LineString, RouteLineProperties> {
  if (points.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }

  const gaps = validGapIndexes(gapAfterIndex, points.length);
  const features: Array<Feature<LineString, RouteLineProperties>> = [];
  let current: LngLat[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!point) continue;
    current.push(point);
    const isLast = index === points.length - 1;
    if (gaps.has(index)) {
      if (current.length >= 2) {
        features.push({
          type: "Feature",
          properties: { gap: false },
          geometry: { type: "LineString", coordinates: current },
        });
      }
      const next = points[index + 1];
      if (next) {
        features.push({
          type: "Feature",
          properties: { gap: true },
          geometry: { type: "LineString", coordinates: [point, next] },
        });
      }
      current = [];
    } else if (isLast && current.length >= 2) {
      features.push({
        type: "Feature",
        properties: { gap: false },
        geometry: { type: "LineString", coordinates: current },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

function routePoint(role: RoutePointRole, position: LngLat): Feature<Point, RoutePointProperties> {
  return {
    type: "Feature",
    properties: { role },
    geometry: { type: "Point", coordinates: position },
  };
}

export function routePointCollection(
  points: readonly LngLat[],
  cursorPosition: LngLat | null,
): FeatureCollection<Point, RoutePointProperties> {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return { type: "FeatureCollection", features: [] };

  const features = [routePoint("start", first), routePoint("end", last)];
  if (cursorPosition) features.push(routePoint("cursor", cursorPosition));
  return { type: "FeatureCollection", features };
}

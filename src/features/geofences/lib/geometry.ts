import type { Geofence, Polygon } from "../../../api/types";
import type { Bounds, LngLat } from "../../../map/types";

export type RingProblem = "too_few_points" | "self_intersection" | "no_area" | "invalid_coordinate";

export type RingValidation = { ok: true; ring: LngLat[] } | { ok: false; problem: RingProblem };

const EPSILON = 1e-9;
const EQUALS_EPSILON = 1e-7;

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function inRange([lon, lat]: LngLat): boolean {
  return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

function samePoint(a: LngLat, b: LngLat): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** Closes a ring without mutating the input; an already-closed ring is returned as a copy. */
export function closeRing(ring: readonly LngLat[]): LngLat[] {
  const copy = ring.map(([lon, lat]) => [lon, lat] as LngLat);
  const first = copy[0];
  const last = copy[copy.length - 1];
  if (!first || !last) return copy;
  if (!samePoint(first, last)) copy.push([first[0], first[1]]);
  return copy;
}

function withoutRepeatedNeighbours(ring: readonly LngLat[]): LngLat[] {
  const result: LngLat[] = [];
  for (const point of ring) {
    const previous = result[result.length - 1];
    if (!previous || !samePoint(previous, point)) result.push(point);
  }
  return result;
}

function orientation(a: LngLat, b: LngLat, c: LngLat): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function sign(value: number): number {
  if (Math.abs(value) <= EPSILON) return 0;
  return value > 0 ? 1 : -1;
}

function withinBox(a: LngLat, b: LngLat, point: LngLat): boolean {
  return (
    point[0] >= Math.min(a[0], b[0]) - EPSILON &&
    point[0] <= Math.max(a[0], b[0]) + EPSILON &&
    point[1] >= Math.min(a[1], b[1]) - EPSILON &&
    point[1] <= Math.max(a[1], b[1]) + EPSILON
  );
}

function segmentsIntersect(a: LngLat, b: LngLat, c: LngLat, d: LngLat): boolean {
  const o1 = sign(orientation(a, b, c));
  const o2 = sign(orientation(a, b, d));
  const o3 = sign(orientation(c, d, a));
  const o4 = sign(orientation(c, d, b));

  if (o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) return true;
  if (o1 === 0 && withinBox(a, b, c)) return true;
  if (o2 === 0 && withinBox(a, b, d)) return true;
  if (o3 === 0 && withinBox(c, d, a)) return true;
  if (o4 === 0 && withinBox(c, d, b)) return true;
  return false;
}

function selfIntersects(ring: readonly LngLat[]): boolean {
  const edges = ring.length - 1;
  for (let i = 0; i < edges; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];
    if (!a || !b) return false;
    for (let j = i + 1; j < edges; j += 1) {
      // Adjacent edges share a vertex by construction; the first and last
      // edges also share the ring's closing point.
      if (j === i + 1) continue;
      if (i === 0 && j === edges - 1) continue;
      const c = ring[j];
      const d = ring[j + 1];
      if (!c || !d) return false;
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

function signedArea(ring: readonly LngLat[]): number {
  let sum = 0;
  const points = ring.length - 1;
  for (let i = 0; i < points; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];
    if (!a || !b) return 0;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

/** Repairs the ring, then applies every rule the server enforces plus coordinate sanity. */
export function validateRing(input: readonly unknown[]): RingValidation {
  const points: LngLat[] = [];
  for (const value of input) {
    if (!Array.isArray(value) || value.length !== 2) {
      return { ok: false, problem: "invalid_coordinate" };
    }
    const [lon, lat] = value;
    if (!isFiniteCoordinate(lon) || !isFiniteCoordinate(lat)) {
      return { ok: false, problem: "invalid_coordinate" };
    }
    const point: LngLat = [lon, lat];
    if (!inRange(point)) return { ok: false, problem: "invalid_coordinate" };
    points.push(point);
  }

  if (points.length < 3) return { ok: false, problem: "too_few_points" };

  const ring = closeRing(withoutRepeatedNeighbours(points));
  const open = ring.slice(0, -1);
  const distinct = new Set(open.map((point) => `${point[0]},${point[1]}`));
  if (distinct.size < 3) return { ok: false, problem: "too_few_points" };
  if (selfIntersects(ring)) return { ok: false, problem: "self_intersection" };
  if (Math.abs(signedArea(ring)) <= EPSILON) return { ok: false, problem: "no_area" };
  return { ok: true, ring };
}

/** The request shape; only a valid ring can become one. */
export function toPolygon(ring: readonly LngLat[]): Polygon {
  return { type: "Polygon", coordinates: [closeRing(ring)] };
}

/** The repaired exterior ring, or null when the stored shape is unusable. */
export function exteriorRing(polygon: Polygon): LngLat[] | null {
  const first = polygon.coordinates[0];
  if (!first) return null;
  const result = validateRing(first);
  return result.ok ? result.ring : null;
}

function pointsEqual(a: LngLat, b: LngLat): boolean {
  return Math.abs(a[0] - b[0]) <= EQUALS_EPSILON && Math.abs(a[1] - b[1]) <= EQUALS_EPSILON;
}

function toLngLatRing(ring: readonly (readonly number[])[]): LngLat[] {
  return closeRing(ring.map((point) => [point[0] ?? 0, point[1] ?? 0] as LngLat));
}

export function geometryEquals(a: Polygon, b: Polygon): boolean {
  const left = exteriorRing(a) ?? toLngLatRing(a.coordinates[0] ?? []);
  const right = exteriorRing(b) ?? toLngLatRing(b.coordinates[0] ?? []);
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const first = left[index];
    const second = right[index];
    if (!first || !second || !pointsEqual(first, second)) return false;
  }
  return true;
}

export function boundsOfRings(rings: readonly (readonly LngLat[])[]): Bounds | null {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  let found = false;

  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      found = true;
      west = Math.min(west, lon);
      south = Math.min(south, lat);
      east = Math.max(east, lon);
      north = Math.max(north, lat);
    }
  }

  return found ? { west, south, east, north } : null;
}

export function boundsOfGeofences(geofences: readonly Geofence[]): Bounds | null {
  const rings: LngLat[][] = [];
  for (const geofence of geofences) {
    for (const ring of geofence.geometry.coordinates) {
      const repaired = validateRing(ring);
      if (repaired.ok) rings.push(repaired.ring);
    }
  }
  return boundsOfRings(rings);
}

const problemCopy: Record<RingProblem, string> = {
  too_few_points: "Draw a polygon with at least three points.",
  self_intersection: "The polygon crosses itself. Adjust the points.",
  no_area: "The polygon has no area. Move the points apart.",
  invalid_coordinate: "A point is outside the map. Adjust the points.",
};

export function ringProblemCopy(problem: RingProblem): string {
  return problemCopy[problem];
}

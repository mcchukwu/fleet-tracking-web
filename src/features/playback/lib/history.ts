import type { Point } from "../../../api/types";
import type { LngLat } from "../../../map/types";
import { GAP_FACTOR, MIN_GAP_MS } from "./constants";

export interface RouteGap {
  /** Index of the last point before the missing span. */
  startIndex: number;
  startMs: number;
  endMs: number;
}

export interface GapResult {
  gapAfterIndex: number[];
  gaps: RouteGap[];
}

export interface Cursor {
  index: number;
  position: LngLat | null;
  inGap: boolean;
  speedKph: number | null;
  headingDeg: number | null;
}

function timeOf(point: Point): number {
  return Date.parse(point.t);
}

/** Ascending by time, one point per timestamp; the last duplicate wins. */
export function normalisePoints(points: readonly Point[]): Point[] {
  const byTime = new Map<number, Point>();
  for (const point of points) {
    const time = timeOf(point);
    if (Number.isNaN(time)) continue;
    byTime.set(time, point);
  }
  return [...byTime.entries()].sort(([a], [b]) => a - b).map(([, point]) => point);
}

export function medianInterval(points: readonly Point[]): number | null {
  if (points.length < 2) return null;
  const intervals: number[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    const delta = timeOf(current) - timeOf(previous);
    if (delta > 0) intervals.push(delta);
  }
  if (intervals.length === 0) return null;
  intervals.sort((a, b) => a - b);
  const middle = Math.floor(intervals.length / 2);
  return intervals.length % 2 === 0
    ? Math.round(((intervals[middle - 1] ?? 0) + (intervals[middle] ?? 0)) / 2)
    : (intervals[middle] ?? null);
}

/**
 * A gap is a real absence of data, not bucket jitter. The threshold is the
 * larger of three median intervals and one minute.
 */
export function findGaps(points: readonly Point[]): GapResult {
  const median = medianInterval(points);
  if (median === null) return { gapAfterIndex: [], gaps: [] };
  const threshold = Math.max(median * GAP_FACTOR, MIN_GAP_MS);

  const gapAfterIndex: number[] = [];
  const gaps: RouteGap[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    const delta = timeOf(current) - timeOf(previous);
    if (delta < threshold) continue;
    gapAfterIndex.push(index - 1);
    gaps.push({ startIndex: index - 1, startMs: timeOf(previous), endMs: timeOf(current) });
  }
  return { gapAfterIndex, gaps };
}

export function indexAtTime(points: readonly Point[], timeMs: number): number {
  if (points.length === 0) return -1;
  const first = points[0];
  if (!first) return -1;
  let low = 0;
  let high = points.length - 1;
  if (timeMs <= timeOf(first)) return 0;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const point = points[middle];
    if (point && timeOf(point) <= timeMs) low = middle;
    else high = middle - 1;
  }
  return low;
}

function lerp(from: LngLat, to: LngLat, ratio: number): LngLat {
  return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
}

export function cursorAt(
  points: readonly Point[],
  timeMs: number,
  gapAfterIndex: readonly number[],
  reducedMotion: boolean,
): Cursor {
  const first = points[0];
  if (!first) return { index: -1, position: null, inGap: false, speedKph: null, headingDeg: null };

  const index = indexAtTime(points, timeMs);
  const current = points[index] ?? first;
  const next = points[index + 1];
  const currentMs = timeOf(current);
  const inGap =
    gapAfterIndex.includes(index) && next !== undefined && timeMs > currentMs;

  if (!next || reducedMotion || inGap || next === current) {
    return {
      index,
      position: [current.lon, current.lat],
      inGap,
      speedKph: inGap ? null : current.speed_kph,
      headingDeg: inGap ? null : current.heading_deg,
    };
  }

  const span = timeOf(next) - currentMs;
  const ratio = span <= 0 ? 0 : Math.min(1, Math.max(0, (timeMs - currentMs) / span));
  return {
    index,
    position: lerp([current.lon, current.lat], [next.lon, next.lat], ratio),
    inGap: false,
    speedKph: current.speed_kph,
    headingDeg: current.heading_deg,
  };
}

export function gapLabel(gap: RouteGap, format: (ms: number) => string): string {
  return `No data ${format(gap.startMs)} to ${format(gap.endMs)}`;
}

import type { Geofence, Point } from "../../../api/types";
import type { Bounds } from "../../../map/types";
import { formatClockTime } from "../../../lib/format";

export interface Position {
  lat: number;
  lon: number;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function valid(lat: unknown, lon: unknown): Position | null {
  if (!finite(lat) || !finite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/** Alert evidence is free-form; accept the two common coordinate spellings. */
export function evidenceCoordinates(evidence: Record<string, unknown>): Position | null {
  const direct = valid(evidence.lat, evidence.lon);
  if (direct) return direct;
  return valid(evidence.latitude, evidence.longitude);
}

export function nearestPoint(
  points: readonly Point[] | null,
  occurredAt: string,
  windowMs: number,
): Point | null {
  const target = Date.parse(occurredAt);
  if (Number.isNaN(target) || !points) return null;

  let best: { point: Point; distance: number; at: number } | null = null;
  for (const point of points) {
    const at = Date.parse(point.t);
    if (Number.isNaN(at)) continue;
    const distance = Math.abs(at - target);
    if (distance > windowMs) continue;
    if (
      best === null ||
      distance < best.distance ||
      (distance === best.distance && at < best.at)
    ) {
      best = { point, distance, at };
    }
  }
  return best?.point ?? null;
}

export function geofenceForAlert(
  evidence: Record<string, unknown>,
  geofences: readonly Geofence[],
): Geofence | null {
  const id = evidence.geofence_id;
  if (typeof id !== "string") return null;
  return geofences.find((geofence) => geofence.id === id) ?? null;
}

export function positionBounds(position: Position, geofence: Geofence | null): Bounds {
  let south = position.lat;
  let west = position.lon;
  let north = position.lat;
  let east = position.lon;

  if (geofence) {
    for (const ring of geofence.geometry.coordinates) {
      for (const pair of ring) {
        const lon = pair[0];
        const lat = pair[1];
        if (!finite(lat) || !finite(lon)) continue;
        south = Math.min(south, lat);
        west = Math.min(west, lon);
        north = Math.max(north, lat);
        east = Math.max(east, lon);
      }
    }
  }

  return { south, west, north, east };
}

export type PositionSource = "evidence" | "history";

export function positionSourceLabel(source: PositionSource, at?: string): string {
  if (source === "evidence") return "From alert evidence";
  if (!at) return "Nearest recorded position";
  const time = Date.parse(at);
  if (Number.isNaN(time)) return "Nearest recorded position";
  return `Nearest position at ${formatClockTime(time)}`;
}

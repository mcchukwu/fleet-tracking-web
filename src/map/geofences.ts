import type { Geofence } from "../api/types";
import type { LngLat, MapGeofence } from "./types";

function isPoint(value: unknown): value is LngLat {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

/** Repairs an unclosed ring and rejects a ring with fewer than three distinct points. */
export function repairRing(input: readonly unknown[]): LngLat[] | null {
  const ring: LngLat[] = [];
  for (const point of input) {
    if (!isPoint(point)) return null;
    ring.push([point[0], point[1]]);
  }
  if (ring.length < 3) return null;

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return null;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);

  const distinct = new Set(ring.slice(0, -1).map((point) => `${point[0]},${point[1]}`));
  return distinct.size >= 3 ? ring : null;
}

export function toMapGeofences(
  geofences: readonly Geofence[],
  highlightedId: string | null = null,
): MapGeofence[] {
  const converted: MapGeofence[] = [];
  for (const geofence of geofences) {
    const rings: LngLat[][] = [];
    for (const ring of geofence.geometry.coordinates) {
      const repaired = repairRing(ring);
      if (repaired) rings.push(repaired);
    }
    if (rings.length === 0) continue;
    converted.push({
      id: geofence.id,
      name: geofence.name,
      kind: geofence.kind,
      rings,
      highlighted: geofence.id === highlightedId,
    });
  }
  return converted;
}

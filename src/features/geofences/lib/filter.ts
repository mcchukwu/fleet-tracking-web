import type { Geofence } from "../../../api/types";

/** Client-side name search; the server ignores every query parameter. */
export function filterGeofences(
  geofences: readonly Geofence[],
  query: string,
): Geofence[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...geofences];
  return geofences.filter((geofence) => geofence.name.toLowerCase().includes(needle));
}

/** Deterministic order: name, then id, so rows cannot swap between refetches. */
export function sortGeofences(geofences: readonly Geofence[]): Geofence[] {
  return [...geofences].sort((a, b) => {
    const byName = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });
}

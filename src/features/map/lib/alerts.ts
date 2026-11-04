import type { Alert, SnapshotVehicle } from "../../../api/types";
import { MISSING, formatNumber } from "../../../lib/format";

/** Alerts key on the vehicle UUID; the map keys positions on external_id. */
export function recentAlertKeys(
  alerts: readonly Alert[],
  vehicles: readonly SnapshotVehicle[],
  now: number,
  windowMs: number,
): Set<string> {
  const byUuid = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.external_id]));
  const keys = new Set<string>();

  for (const alert of alerts) {
    if (alert.status !== "open") continue;
    const occurred = Date.parse(alert.occurred_at);
    if (Number.isNaN(occurred)) continue;
    if (occurred < now - windowMs) continue;
    const key = byUuid.get(alert.vehicle_id);
    if (key) keys.add(key);
  }

  return keys;
}

export function openAlertCountLabel(count: number | undefined, limit: number): string {
  if (count === undefined) return MISSING;
  return count >= limit ? `${formatNumber(limit)}+` : formatNumber(count);
}

import type { SnapshotVehicle } from "../../../api/types";
import { STALE_AFTER_MS, getDataFreshness, getVehicleStatus } from "../../../lib/status";
import type { LivePosition } from "../../../stores/live";
import { ALERT_MARK_WINDOW_MS } from "./constants";
import type { VehicleRow } from "./filter";

/**
 * One shared derivation for the map list and the drawer: live position first,
 * snapshot second, status from getVehicleStatus(), freshness from the age.
 */
export function toVehicleRow(
  vehicle: SnapshotVehicle,
  live: LivePosition | undefined,
  alertKeys: ReadonlySet<string>,
  now: number,
): VehicleRow {
  const recordedAt = live?.recordedAt ?? vehicle.recorded_at ?? null;
  const recordedAtMs =
    live?.positionAt ?? (vehicle.recorded_at ? Date.parse(vehicle.recorded_at) : null);
  const ageMs = recordedAtMs !== null ? now - recordedAtMs : null;
  const freshness = getDataFreshness(ageMs);
  const speedKph = live?.speedKph ?? vehicle.speed_kph ?? null;
  const headingDeg = live?.headingDeg ?? vehicle.heading_deg ?? null;
  const speedReportedAtMs =
    live?.speedAt ??
    (speedKph !== null || headingDeg !== null
      ? vehicle.recorded_at
        ? Date.parse(vehicle.recorded_at)
        : null
      : null);
  const isOnline = live ? ageMs !== null && ageMs <= STALE_AFTER_MS : vehicle.online;
  const recentlyMarked =
    live?.alertMarkedAt !== null &&
    live?.alertMarkedAt !== undefined &&
    now - live.alertMarkedAt <= ALERT_MARK_WINDOW_MS;
  const status = getVehicleStatus({
    online: isOnline,
    speed_kph: speedKph,
    recorded_at: recordedAt,
    openAlerts: alertKeys.has(vehicle.external_id) || recentlyMarked ? 1 : 0,
    now,
  });

  return {
    id: vehicle.id,
    key: vehicle.external_id,
    plate: vehicle.plate,
    driverName: vehicle.driver_name ?? null,
    depot: vehicle.depot,
    online: isOnline,
    lat: live?.lat ?? vehicle.lat ?? null,
    lon: live?.lon ?? vehicle.lon ?? null,
    recordedAt,
    recordedAtMs,
    speedKph,
    speedReportedAtMs,
    headingDeg,
    status,
    freshness,
    ageSeconds: ageMs !== null ? Math.max(0, Math.floor(ageMs / 1_000)) : null,
    stale: freshness === "stale",
    ...(vehicle.trip_status ? { tripStatus: vehicle.trip_status } : {}),
  };
}

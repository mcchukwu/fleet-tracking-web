import { useEffect, useMemo, useState } from "react";
import type { Alert, SnapshotVehicle } from "../../../api/types";
import {
  STALE_AFTER_MS,
  getDataFreshness,
  getVehicleStatus,
} from "../../../lib/status";
import type { MapVehicle } from "../../../map/types";
import { useLiveStore } from "../../../stores/live";
import { ALERT_MARK_WINDOW_MS, LIST_CLOCK_MS } from "../lib/constants";
import { recentAlertKeys } from "../lib/alerts";
import type { VehicleRow } from "../lib/filter";

export interface UseMapDataInput {
  snapshot: readonly SnapshotVehicle[] | undefined;
  alerts: readonly Alert[] | undefined;
  selectedId: string | null;
  hoveredKey: string | null;
}

export interface MapData {
  rows: VehicleRow[];
  mapVehicles: MapVehicle[];
  total: number;
  positioned: number;
  online: number;
  activeTrips: number;
  lastDataAtMs: number | null;
  lastDataAgeSeconds: number | null;
  now: number;
}

export function useMapData({
  snapshot,
  alerts,
  selectedId,
  hoveredKey,
}: UseMapDataInput): MapData {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), LIST_CLOCK_MS);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    const vehicles = snapshot ?? [];
    const positions = useLiveStore.getState().positions;
    const alertKeys = alerts ? recentAlertKeys(alerts, vehicles, now, ALERT_MARK_WINDOW_MS) : new Set<string>();

    const rows: VehicleRow[] = vehicles.map((vehicle) => {
      const live = positions[vehicle.external_id];
      const recordedAt = live?.recordedAt ?? vehicle.recorded_at ?? null;
      const recordedAtMs = live?.positionAt ?? (vehicle.recorded_at ? Date.parse(vehicle.recorded_at) : null);
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
    });

    const positioned = rows.filter((row) => row.lat !== null && row.lon !== null).length;
    const online = rows.filter((row) => row.online).length;
    const activeTrips = vehicles.filter((vehicle) => vehicle.trip_status === "active").length;
    const lastDataAtMs = rows.reduce<number | null>(
      (latest, row) =>
        row.recordedAtMs !== null && (latest === null || row.recordedAtMs > latest)
          ? row.recordedAtMs
          : latest,
      null,
    );
    const lastDataAgeSeconds =
      lastDataAtMs === null ? null : Math.max(0, Math.floor((now - lastDataAtMs) / 1_000));

    const mapVehicles = rows.flatMap((row): MapVehicle[] => {
      if (row.lat === null || row.lon === null) return [];
      return [
        {
          key: row.key,
          position: [row.lon, row.lat],
          headingDeg: row.headingDeg,
          status: row.status,
          label: row.plate,
          selected: row.id === selectedId,
          hovered: row.key === hoveredKey,
          stale: row.stale,
        },
      ];
    });

    return {
      rows,
      mapVehicles,
      total: vehicles.length,
      positioned,
      online,
      activeTrips,
      lastDataAtMs,
      lastDataAgeSeconds,
      now,
    };
  }, [snapshot, alerts, now, selectedId, hoveredKey]);
}

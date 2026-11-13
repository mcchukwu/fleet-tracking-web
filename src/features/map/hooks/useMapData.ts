import { useEffect, useMemo, useState } from "react";
import type { Alert, SnapshotVehicle } from "../../../api/types";
import type { MapVehicle } from "../../../map/types";
import { useLiveStore, type LivePosition } from "../../../stores/live";
import { ALERT_MARK_WINDOW_MS, LIST_CLOCK_MS } from "../lib/constants";
import { recentAlertKeys } from "../lib/alerts";
import type { VehicleRow } from "../lib/filter";
import { toVehicleRow } from "../lib/row";

const HIGH_VOLUME_THRESHOLD = 1_000;
const HIGH_VOLUME_FPS = 20;

export interface UseMapDataInput {
  snapshot: readonly SnapshotVehicle[] | undefined;
  alerts: readonly Alert[] | undefined;
  selectedId: string | null;
  hoveredKey: string | null;
}

function readPositions(_version: number): Record<string, LivePosition> {
  return useLiveStore.getState().positions;
}

/** Live positions drive the map at frame rate, throttled for very large fleets. */
function useLiveVersion(vehicleCount: number): number {
  const [version, setVersion] = useState(() => useLiveStore.getState().version);

  useEffect(() => {
    if (vehicleCount <= HIGH_VOLUME_THRESHOLD) {
      return useLiveStore.subscribe((state) => setVersion(state.version));
    }

    const interval = 1_000 / HIGH_VOLUME_FPS;
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      last = performance.now();
      setVersion(useLiveStore.getState().version);
    };
    const unsubscribe = useLiveStore.subscribe((state) => {
      const now = performance.now();
      if (now - last >= interval) {
        last = now;
        setVersion(state.version);
        return;
      }
      if (timer === null) timer = setTimeout(flush, interval - (now - last));
    });

    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [vehicleCount]);

  return version;
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

export function useMapData({ snapshot, alerts, selectedId, hoveredKey }: UseMapDataInput): MapData {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), LIST_CLOCK_MS);
    return () => clearInterval(timer);
  }, []);

  const liveVersion = useLiveVersion(snapshot?.length ?? 0);

  const rows = useMemo(() => {
    const vehicles = snapshot ?? [];
    const positions = useLiveStore.getState().positions;
    const alertKeys = alerts
      ? recentAlertKeys(alerts, vehicles, now, ALERT_MARK_WINDOW_MS)
      : new Set<string>();

    const nextRows: VehicleRow[] = vehicles.map((vehicle) =>
      toVehicleRow(vehicle, positions[vehicle.external_id], alertKeys, now),
    );

    const lastDataAtMs = nextRows.reduce<number | null>(
      (latest, row) =>
        row.recordedAtMs !== null && (latest === null || row.recordedAtMs > latest)
          ? row.recordedAtMs
          : latest,
      null,
    );
    const lastDataAgeSeconds =
      lastDataAtMs === null ? null : Math.max(0, Math.floor((now - lastDataAtMs) / 1_000));
    const activeTrips = vehicles.filter((vehicle) => vehicle.trip_status === "active").length;

    return {
      rows: nextRows,
      total: vehicles.length,
      activeTrips,
      lastDataAtMs,
      lastDataAgeSeconds,
      now,
    };
  }, [snapshot, alerts, now]);

  // The version is the cache key: positions are read imperatively so the 1s
  // list clock does not gate the map target.
  const positions = useMemo(() => readPositions(liveVersion), [liveVersion]);

  const mapVehicles = useMemo(
    () =>
      rows.rows.flatMap((row): MapVehicle[] => {
        const live = positions[row.key];
        const lat = live?.lat ?? row.lat;
        const lon = live?.lon ?? row.lon;
        if (lat === null || lon === null) return [];
        return [
          {
            key: row.key,
            position: [lon, lat],
            headingDeg: live?.headingDeg ?? row.headingDeg,
            status: row.status,
            label: row.plate,
            selected: row.id === selectedId,
            hovered: row.key === hoveredKey,
            stale: row.stale,
          },
        ];
      }),
    [rows.rows, positions, selectedId, hoveredKey],
  );

  return {
    rows: rows.rows,
    mapVehicles,
    total: rows.total,
    positioned: rows.rows.filter((row) => row.lat !== null && row.lon !== null).length,
    online: rows.rows.filter((row) => row.online).length,
    activeTrips: rows.activeTrips,
    lastDataAtMs: rows.lastDataAtMs,
    lastDataAgeSeconds: rows.lastDataAgeSeconds,
    now,
  };
}

import type { AlertSeverity, TripStatus } from "../../../api/types";
import type { Bounds } from "../../../map/types";
import type { DataFreshness, VehicleDisplayStatus } from "../../../lib/status";

export type MapSort = "plate" | "lastSeen" | "status";

export interface VehicleRow {
  id: string;
  key: string;
  plate: string;
  driverName: string | null;
  depot: string;
  online: boolean;
  lat: number | null;
  lon: number | null;
  recordedAt: string | null;
  recordedAtMs: number | null;
  speedKph: number | null;
  speedReportedAtMs: number | null;
  headingDeg: number | null;
  status: VehicleDisplayStatus;
  freshness: DataFreshness;
  ageSeconds: number | null;
  stale: boolean;
  tripStatus?: TripStatus;
  alertSeverity?: AlertSeverity;
}

export interface MapFilterValues {
  q: string;
  statuses: readonly VehicleDisplayStatus[];
  depot: string | null;
  sort: MapSort;
  onlyInView: boolean;
}

const displayStatuses: readonly VehicleDisplayStatus[] = ["moving", "idle", "offline", "alert"];

export function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

export function normalizeSearch(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]/g, "");
}

export function parseStatuses(value: string | undefined): VehicleDisplayStatus[] {
  if (!value) return [];
  const seen = new Set<VehicleDisplayStatus>();
  for (const part of value.split(",")) {
    const candidate = part.trim() as VehicleDisplayStatus;
    if (displayStatuses.includes(candidate)) seen.add(candidate);
  }
  return [...seen];
}

export function serializeStatuses(statuses: readonly VehicleDisplayStatus[]): string | undefined {
  return statuses.length > 0 ? statuses.join(",") : undefined;
}

export function matchesQuery(row: VehicleRow, query: string): boolean {
  const normalized = normalizeSearch(query);
  if (!normalized) return true;
  return (
    normalizePlate(row.plate).toLowerCase().includes(normalized) ||
    normalizeSearch(row.key).includes(normalized)
  );
}

function withinBounds(row: VehicleRow, bounds: Bounds | null): boolean {
  if (!bounds) return true;
  if (row.lat === null || row.lon === null) return false;
  return (
    row.lat >= bounds.south &&
    row.lat <= bounds.north &&
    row.lon >= bounds.west &&
    row.lon <= bounds.east
  );
}

export function filterRows(
  rows: readonly VehicleRow[],
  filters: MapFilterValues,
  bounds: Bounds | null = null,
): VehicleRow[] {
  return rows.filter((row) => {
    if (!matchesQuery(row, filters.q)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(row.status)) return false;
    if (filters.depot && row.depot !== filters.depot) return false;
    if (filters.onlyInView && !withinBounds(row, bounds)) return false;
    return true;
  });
}

const statusRank: Record<VehicleDisplayStatus, number> = {
  alert: 0,
  moving: 1,
  idle: 2,
  offline: 3,
};

export function sortRows(rows: readonly VehicleRow[], sort: MapSort): VehicleRow[] {
  return [...rows].sort((a, b) => {
    if (sort === "plate") return a.plate.localeCompare(b.plate, "en");
    if (sort === "status") {
      const rank = statusRank[a.status] - statusRank[b.status];
      if (rank !== 0) return rank;
      return a.plate.localeCompare(b.plate, "en");
    }

    if (a.recordedAtMs === null && b.recordedAtMs === null) {
      return a.plate.localeCompare(b.plate, "en");
    }
    if (a.recordedAtMs === null) return 1;
    if (b.recordedAtMs === null) return -1;
    if (b.recordedAtMs !== a.recordedAtMs) return b.recordedAtMs - a.recordedAtMs;
    return a.plate.localeCompare(b.plate, "en");
  });
}

export function filterSignature(filters: MapFilterValues): string {
  return [filters.q, filters.statuses.join(","), filters.depot ?? "", filters.sort, filters.onlyInView ? "1" : "0"].join("|");
}

export function nextSelectionKey(
  rows: readonly VehicleRow[],
  currentKey: string | null,
  delta: 1 | -1,
): string | null {
  if (rows.length === 0) return null;
  const index = currentKey ? rows.findIndex((row) => row.key === currentKey) : -1;
  if (index === -1) return rows[delta > 0 ? 0 : rows.length - 1]?.key ?? null;
  const next = (index + delta + rows.length) % rows.length;
  return rows[next]?.key ?? null;
}

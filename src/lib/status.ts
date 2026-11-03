import type { AlertSeverity, AlertType, TripStatus } from "../api/types";

export type VehicleDisplayStatus = "moving" | "idle" | "offline" | "alert";
export type DataFreshness = "fresh" | "delayed" | "stale";

export const DELAYED_AFTER_MS = 30_000;
export const STALE_AFTER_MS = 5 * 60_000;

export interface VehicleStatusInput {
  online: boolean;
  speed_kph?: number | null;
  recorded_at?: string | null;
  openAlerts?: number;
  now: number;
}

export function getVehicleStatus(input: VehicleStatusInput): VehicleDisplayStatus {
  if ((input.openAlerts ?? 0) > 0) return "alert";
  if (!input.online) return "offline";
  if (!input.recorded_at) return "offline";

  const recorded = Date.parse(input.recorded_at);
  if (Number.isNaN(recorded)) return "offline";
  if (input.now - recorded > STALE_AFTER_MS) return "offline";

  return (input.speed_kph ?? 0) > 0 ? "moving" : "idle";
}

export function getDataFreshness(ageMs: number | null | undefined): DataFreshness {
  if (ageMs === null || ageMs === undefined) return "stale";
  if (ageMs <= DELAYED_AFTER_MS) return "fresh";
  if (ageMs <= STALE_AFTER_MS) return "delayed";
  return "stale";
}

export const vehicleStatusLabels: Record<VehicleDisplayStatus, string> = {
  moving: "Moving",
  idle: "Idle",
  offline: "Offline",
  alert: "Alert",
};

export const tripStatusLabels: Record<TripStatus, string> = {
  planned: "Planned",
  assigned: "Assigned",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const alertStatusLabels = {
  open: "Open",
  acked: "Acknowledged",
  closed: "Closed",
} as const;

export const severityLabels: Record<AlertSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const alertTypeLabels: Record<AlertType, string> = {
  geofence_enter: "Geofence entry",
  geofence_exit: "Geofence exit",
  route_deviation: "Route deviation",
  idle: "Idle",
  speeding: "Speeding",
  device_offline: "Device offline",
  unplanned_trip: "Unplanned trip",
};

const alertTypeLookup: Record<string, string> = alertTypeLabels;

export function alertTypeLabel(type: string): string {
  return alertTypeLookup[type] ?? `Unknown type: ${type}`;
}

const severityRank: Record<AlertSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function compareSeverity(a: AlertSeverity, b: AlertSeverity): number {
  return severityRank[b] - severityRank[a];
}

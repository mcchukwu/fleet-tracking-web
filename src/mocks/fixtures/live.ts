import type { AlertMessage, PositionMessage } from "../../api/schemas";

export const positionFrame: PositionMessage = {
  type: "position" as const,
  tenant_id: "tenant-demo",
  vehicle_id: "demo-imei-0019",
  lat: 6.5244,
  lon: 3.3792,
  recorded_at: "2026-11-03T08:13:29Z",
};

export const olderPositionFrame: PositionMessage = {
  ...positionFrame,
  lat: 6.5,
  lon: 3.3,
  recorded_at: "2026-11-03T08:10:00Z",
};

// Provisional: the alert frame shape is derived from the OpenAPI message schema.
// Capture a real alert frame from staging before Slice 4 builds its UI on it.
export const alertFrame: AlertMessage = {
  type: "alert" as const,
  tenant_id: "tenant-demo",
  vehicle_id: "demo-imei-0007",
  alert: {
    type: "geofence_exit",
    severity: "high",
    occurred_at: "2026-11-03T08:20:00Z",
    geofence_id: "00000000-0000-0000-0000-000000000202",
    geofence_name: "Lekki Depot",
    event_type: "exit",
    extra_field: "kept for forward compatibility",
  },
};

export const malformedLiveFrames: unknown[] = [
  null,
  "{not json",
  { type: "position", tenant_id: "tenant-demo", lat: 6.5, lon: 3.4, recorded_at: "2026-11-03T08:13:29Z" },
  { type: "position", tenant_id: "tenant-demo", vehicle_id: "demo-imei-0019", lat: "6.5", lon: 3.4, recorded_at: "2026-11-03T08:13:29Z" },
  { type: "position", tenant_id: "tenant-demo", vehicle_id: "demo-imei-0019", lat: 6.5, lon: 3.4, recorded_at: "not-a-date" },
  { type: "alert", tenant_id: "tenant-demo", vehicle_id: "demo-imei-0007" },
  { type: "unknown", tenant_id: "tenant-demo" },
];

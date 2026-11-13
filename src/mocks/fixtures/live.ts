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

// Provisional: no real alert frame has been observed on staging.
// Two documented shapes exist; both are accepted until Slice 4 captures a real one.
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

// docs/api/frontend-integration.md example.
export const openApiAlertFrame: AlertMessage = {
  type: "alert",
  vehicle_id: "demo-imei-0007",
  severity: "high",
  occurred_at: "2026-11-03T08:21:00Z",
};

// docs/api/api-types.ts AlertMessage example: no alert id, no severity.
export const handoffAlertFrame: AlertMessage = {
  type: "alert",
  tenant_id: "tenant-demo",
  vehicle_id: "demo-imei-0007",
  alert: {
    tenant_id: "tenant-demo",
    vehicle_id: "demo-imei-0007",
    geofence_id: "00000000-0000-0000-0000-000000000202",
    geofence_name: "Lekki Depot",
    event_type: "exit",
    event_time: "2026-11-03T08:22:00Z",
    latency_ns: 1_500_000,
  },
};

export const malformedLiveFrames: unknown[] = [
  null,
  "{not json",
  {
    type: "position",
    tenant_id: "tenant-demo",
    lat: 6.5,
    lon: 3.4,
    recorded_at: "2026-11-03T08:13:29Z",
  },
  {
    type: "position",
    tenant_id: "tenant-demo",
    vehicle_id: "demo-imei-0019",
    lat: "6.5",
    lon: 3.4,
    recorded_at: "2026-11-03T08:13:29Z",
  },
  {
    type: "position",
    tenant_id: "tenant-demo",
    vehicle_id: "demo-imei-0019",
    lat: 6.5,
    lon: 3.4,
    recorded_at: "not-a-date",
  },
  { type: "alert", tenant_id: "tenant-demo" },
  { type: "unknown", tenant_id: "tenant-demo" },
];

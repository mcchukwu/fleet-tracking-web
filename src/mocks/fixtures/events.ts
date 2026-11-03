import type { VehicleEvent } from "../../api/types";

export const vehicleEventsFixture: VehicleEvent[] = [
  {
    kind: "alert",
    type: "geofence_exit",
    name: "Lekki Depot",
    severity: "high",
    status: "open",
    at: "2026-11-02T20:07:43.982657Z",
    evidence: { geofence_id: "00000000-0000-0000-0000-000000000202" },
  },
  {
    kind: "geofence",
    type: "geofence_enter",
    name: "Refinery Gate",
    at: "2026-11-02T17:31:00Z",
    evidence: { geofence_id: "00000000-0000-0000-0000-000000000201" },
  },
  {
    kind: "alert",
    type: "speeding",
    severity: "critical",
    status: "acked",
    at: "2026-11-02T16:12:00Z",
    evidence: { speed_kph: 96, limit_kph: 80 },
  },
];

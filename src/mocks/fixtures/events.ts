import type { VehicleEvent } from "../../api/types";

/**
 * Staging returns two shapes with only `at, kind, type` guaranteed:
 * geofence events use `enter`/`exit` and carry a name; alert events carry an
 * alert type plus severity, status and evidence. Newest first.
 */
export const vehicleEventsFixture: VehicleEvent[] = [
  {
    kind: "alert",
    type: "route_deviation",
    severity: "high",
    status: "open",
    at: "2026-11-02T20:07:43.982657Z",
    evidence: { distance_m: 2091.58 },
  },
  {
    kind: "geofence",
    type: "exit",
    name: "Lekki Depot",
    at: "2026-11-02T19:42:11Z",
  },
  {
    kind: "alert",
    type: "geofence_enter",
    severity: "medium",
    status: "open",
    at: "2026-11-02T18:15:00Z",
    evidence: { geofence_id: "00000000-0000-0000-0000-000000000202" },
  },
  {
    kind: "alert",
    type: "speeding",
    severity: "critical",
    status: "acked",
    at: "2026-11-02T16:12:00Z",
    evidence: { speed_kph: 96, limit_kph: 80 },
  },
  {
    kind: "geofence",
    type: "enter",
    name: "Refinery Gate",
    at: "2026-11-02T14:31:00Z",
  },
];

import type { Alert, Vehicle } from "../../api/types";
import { vehiclesFixture } from "./vehicles";

function vehicleAt(index: number): Vehicle {
  const vehicle = vehiclesFixture[index];
  if (!vehicle) throw new Error("fixture does not contain that vehicle");
  return vehicle;
}

const first = vehicleAt(0);
const second = vehicleAt(1);
const third = vehicleAt(2);
const fourth = vehicleAt(3);

export const alertsFixture: Alert[] = [
  {
    id: "fbad9142-c164-463d-ae76-3262f2d3b4f9",
    vehicle_id: third.id,
    plate: third.plate,
    type: "geofence_exit",
    severity: "high",
    status: "open",
    occurred_at: "2026-11-02T20:07:43.982657Z",
    evidence: { geofence_id: "00000000-0000-0000-0000-000000000203" },
  },
  {
    id: "ac1a223c-f9b0-46f3-9ead-13a10bfd6389",
    vehicle_id: second.id,
    plate: second.plate,
    trip_id: "d72adc9e-d315-4a84-9c61-41735c005811",
    type: "route_deviation",
    severity: "high",
    status: "open",
    occurred_at: "2026-11-02T20:07:39.179742Z",
    evidence: { distance_m: 2091.5814676 },
  },
  {
    id: "5d1b0fbf-ff7f-4200-aadc-afdf7f337a04",
    vehicle_id: fourth.id,
    plate: fourth.plate,
    type: "geofence_enter",
    severity: "medium",
    status: "open",
    occurred_at: "2026-11-02T20:07:08.112623Z",
    evidence: { geofence_id: "07819dea-26ef-448c-8d1e-8b1f3abacf19" },
  },
  {
    id: "6f0d7b4a-3c2e-4a7b-9d41-0f7a8c1e2b10",
    vehicle_id: first.id,
    plate: first.plate,
    type: "idle",
    severity: "low",
    status: "acked",
    occurred_at: "2026-11-02T18:04:00Z",
    acked_at: "2026-11-02T18:10:00Z",
    evidence: { duration_s: 620, speed_kph: 0 },
  },
  {
    id: "9b2e5c1d-7a34-4f60-8c92-1e5d3a7b9f21",
    vehicle_id: third.id,
    plate: third.plate,
    type: "speeding",
    severity: "critical",
    status: "open",
    occurred_at: "2026-11-02T17:45:00Z",
    evidence: { speed_kph: 96, limit_kph: 80, duration_s: 140 },
  },
  {
    id: "c4a8e2f1-5b63-4d70-9a18-2f4c6e8d0b32",
    vehicle_id: second.id,
    plate: second.plate,
    type: "device_offline",
    severity: "medium",
    status: "closed",
    occurred_at: "2026-11-02T15:00:00Z",
    evidence: { last_seen_at: "2026-11-02T14:42:00Z", duration_s: 1080 },
  },
  {
    id: "e7f3a1c2-9d48-4b56-8e23-3a5c7f9d1e43",
    vehicle_id: fourth.id,
    plate: fourth.plate,
    type: "unplanned_trip",
    severity: "high",
    status: "open",
    occurred_at: "2026-11-02T12:30:00Z",
    evidence: {},
  },
  {
    id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c54",
    vehicle_id: first.id,
    plate: first.plate,
    type: "solar_flare",
    severity: "high",
    status: "open",
    occurred_at: "2026-11-02T11:15:00Z",
    evidence: { sensor: "x-ray" },
  },
  {
    id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d65",
    vehicle_id: second.id,
    plate: second.plate,
    type: "idle",
    severity: "extreme",
    status: "open",
    occurred_at: "2026-11-02T10:10:00Z",
    evidence: { duration_s: 1200 },
  },
  {
    id: "3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e76",
    vehicle_id: first.id,
    plate: first.plate,
    type: "idle",
    severity: "high",
    status: "pending",
    occurred_at: "2026-11-02T09:05:00Z",
    evidence: { duration_s: 900 },
  },
];

export const openAlertsFixture = alertsFixture.filter((alert) => alert.status === "open");

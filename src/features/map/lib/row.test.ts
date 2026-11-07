import { describe, expect, it } from "vitest";
import type { SnapshotVehicle } from "../../../api/types";
import type { LivePosition } from "../../../stores/live";
import { toVehicleRow } from "./row";

const now = Date.parse("2026-11-07T12:00:00Z");

const vehicle: SnapshotVehicle = {
  id: "vehicle-1",
  external_id: "demo-imei-0001",
  plate: "LSD-100-AA",
  depot: "Lekki Depot",
  driver_name: "Adebayo Okafor",
  online: true,
  lat: 6.5,
  lon: 3.4,
  speed_kph: 40,
  heading_deg: 90,
  recorded_at: "2026-11-07T11:59:30Z",
};

function live(overrides: Partial<LivePosition> = {}): LivePosition {
  return {
    key: vehicle.external_id,
    lat: 6.6,
    lon: 3.5,
    positionAt: now - 5_000,
    recordedAt: "2026-11-07T11:59:55Z",
    speedKph: 55,
    headingDeg: 180,
    speedAt: now - 5_000,
    alertMarkedAt: null,
    ...overrides,
  };
}

describe("toVehicleRow", () => {
  it("prefers a newer live position over the snapshot", () => {
    const row = toVehicleRow(vehicle, live(), new Set(), now);
    expect(row.lat).toBe(6.6);
    expect(row.lon).toBe(3.5);
    expect(row.speedKph).toBe(55);
    expect(row.headingDeg).toBe(180);
    expect(row.status).toBe("moving");
    expect(row.freshness).toBe("fresh");
  });

  it("treats a stale snapshot as stale and offline", () => {
    const row = toVehicleRow(
      { ...vehicle, recorded_at: "2026-11-07T11:40:00Z" },
      undefined,
      new Set(),
      now,
    );
    expect(row.freshness).toBe("stale");
    expect(row.stale).toBe(true);
    expect(row.status).toBe("offline");
    expect(row.ageSeconds).toBe(1_200);
  });

  it("keeps a vehicle with no position, speed or time as offline", () => {
    const row = toVehicleRow(
      {
        id: "v2",
        external_id: "demo-imei-0002",
        plate: "TEST-101-AA",
        depot: "Apapa Depot",
        online: false,
      },
      undefined,
      new Set(),
      now,
    );
    expect(row.lat).toBeNull();
    expect(row.lon).toBeNull();
    expect(row.speedKph).toBeNull();
    expect(row.recordedAt).toBeNull();
    expect(row.status).toBe("offline");
    expect(row.freshness).toBe("stale");
  });

  it("marks a vehicle alert when an open alert exists", () => {
    const row = toVehicleRow(vehicle, undefined, new Set([vehicle.external_id]), now);
    expect(row.status).toBe("alert");
  });

  it("marks a vehicle alert for a recently marked live position", () => {
    const row = toVehicleRow(
      vehicle,
      live({ alertMarkedAt: now - 60_000 }),
      new Set(),
      now,
    );
    expect(row.status).toBe("alert");
  });

  it("ignores an alert mark outside the 15 minute window", () => {
    const row = toVehicleRow(
      vehicle,
      live({ alertMarkedAt: now - 16 * 60_000 }),
      new Set(),
      now,
    );
    expect(row.status).toBe("moving");
  });
});

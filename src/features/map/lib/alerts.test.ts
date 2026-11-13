import { describe, expect, it } from "vitest";
import type { Alert, SnapshotVehicle } from "../../../api/types";
import { recentAlertKeys } from "./alerts";

const NOW = Date.parse("2026-11-04T10:00:00Z");

const vehicles: SnapshotVehicle[] = [
  {
    id: "uuid-1",
    external_id: "demo-imei-0001",
    plate: "LSD-100-AA",
    depot: "Lekki Depot",
    online: true,
  },
  {
    id: "uuid-2",
    external_id: "demo-imei-0002",
    plate: "LSD-101-AA",
    depot: "Lekki Depot",
    online: true,
  },
];

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "alert-1",
    vehicle_id: "uuid-1",
    plate: "LSD-100-AA",
    type: "geofence_exit",
    severity: "high",
    status: "open",
    occurred_at: "2026-11-04T09:55:00Z",
    evidence: {},
    ...overrides,
  };
}

describe("map alert window", () => {
  it("maps the alert UUID to the external vehicle key", () => {
    const keys = recentAlertKeys([alert()], vehicles, NOW, 15 * 60_000);
    expect([...keys]).toEqual(["demo-imei-0001"]);
  });

  it("drops old, acked and unknown-vehicle alerts", () => {
    const keys = recentAlertKeys(
      [
        alert({ occurred_at: "2026-11-04T09:00:00Z" }),
        alert({ id: "alert-2", status: "acked" }),
        alert({ id: "alert-3", vehicle_id: "missing" }),
      ],
      vehicles,
      NOW,
      15 * 60_000,
    );
    expect(keys.size).toBe(0);
  });

  it("includes an alert just inside the window and excludes one just outside", () => {
    const inside = recentAlertKeys(
      [alert({ occurred_at: "2026-11-04T09:45:00Z" })],
      vehicles,
      NOW,
      15 * 60_000,
    );
    const outside = recentAlertKeys(
      [alert({ occurred_at: "2026-11-04T09:44:59Z" })],
      vehicles,
      NOW,
      15 * 60_000,
    );
    expect(inside.size).toBe(1);
    expect(outside.size).toBe(0);
  });
});

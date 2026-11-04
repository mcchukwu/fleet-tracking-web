import { describe, expect, it } from "vitest";
import {
  alertTypeLabel,
  compareSeverity,
  getDataFreshness,
  getVehicleStatus,
  isAlertType,
  tripStatusLabels,
  vehicleStatusLabels,
} from "./status";

const now = Date.parse("2026-11-03T12:00:00Z");

describe("getVehicleStatus", () => {
  it("lets an open alert outrank everything else", () => {
    expect(
      getVehicleStatus({
        online: false,
        speed_kph: 0,
        recorded_at: "2026-11-03T10:00:00Z",
        openAlerts: 1,
        now,
      }),
    ).toBe("alert");
  });

  it("reports offline when the device is offline", () => {
    expect(
      getVehicleStatus({ online: false, speed_kph: 60, recorded_at: "2026-11-03T11:59:50Z", now }),
    ).toBe("offline");
  });

  it("reports moving when the vehicle has speed and fresh data", () => {
    expect(
      getVehicleStatus({ online: true, speed_kph: 42, recorded_at: "2026-11-03T11:59:50Z", now }),
    ).toBe("moving");
  });

  it("reports idle when the vehicle is online but stationary", () => {
    expect(
      getVehicleStatus({ online: true, speed_kph: 0, recorded_at: "2026-11-03T11:59:50Z", now }),
    ).toBe("idle");
  });

  it("treats data older than five minutes as offline", () => {
    expect(
      getVehicleStatus({ online: true, speed_kph: 60, recorded_at: "2026-11-03T11:54:59Z", now }),
    ).toBe("offline");
  });

  it("treats missing data as offline", () => {
    expect(getVehicleStatus({ online: true, now })).toBe("offline");
  });
});

describe("data freshness", () => {
  it("is fresh up to thirty seconds, delayed to five minutes, then stale", () => {
    expect(getDataFreshness(1_000)).toBe("fresh");
    expect(getDataFreshness(30_001)).toBe("delayed");
    expect(getDataFreshness(5 * 60_000)).toBe("delayed");
    expect(getDataFreshness(5 * 60_000 + 1)).toBe("stale");
    expect(getDataFreshness(null)).toBe("stale");
  });
});

describe("labels and ordering", () => {
  it("orders severity with the worst first", () => {
    expect(compareSeverity("critical", "high")).toBeLessThan(0);
    expect(compareSeverity("low", "medium")).toBeGreaterThan(0);
    expect(compareSeverity("high", "high")).toBe(0);
  });

  it("labels every alert type", () => {
    expect(alertTypeLabel("geofence_enter")).toBe("Geofence entry");
    expect(alertTypeLabel("route_deviation")).toBe("Route deviation");
    expect(alertTypeLabel("device_offline")).toBe("Device offline");
  });

  it("renders an unknown alert type as a neutral fallback, not a crash", () => {
    expect(alertTypeLabel("solar_flare")).toBe("Unknown type: solar_flare");
  });

  it("does not treat prototype keys as alert types", () => {
    for (const value of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
      expect(isAlertType(value)).toBe(false);
      expect(alertTypeLabel(value)).toBe(`Unknown type: ${value}`);
    }
  });

  it("labels every trip and vehicle status", () => {
    expect(tripStatusLabels.completed).toBe("Completed");
    expect(vehicleStatusLabels.alert).toBe("Alert");
  });
});

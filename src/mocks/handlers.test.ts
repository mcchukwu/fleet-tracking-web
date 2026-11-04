import { describe, expect, it } from "vitest";
import { appendMockAlert, freshenVehicles } from "./handlers";
import { vehiclesFixture } from "./fixtures/vehicles";
import { perfVehicles } from "./perf";

describe("mock data helpers", () => {
  it("gives online vehicles a fresh reported time", () => {
    const now = Date.parse("2026-11-04T10:00:00Z");
    const fresh = freshenVehicles(vehiclesFixture, now);
    const online = fresh.find((vehicle) => vehicle.online);
    const offline = fresh.find((vehicle) => !vehicle.online);

    expect(online?.recorded_at).toBeDefined();
    expect(now - Date.parse(online?.recorded_at ?? "")).toBeLessThan(30_000);
    expect(offline?.recorded_at).toBeUndefined();
  });

  it("generates a deterministic 5,000-vehicle fleet", () => {
    const now = Date.parse("2026-11-04T10:00:00Z");
    const first = perfVehicles(5_000, now);
    const second = perfVehicles(5_000, now);

    expect(first).toHaveLength(5_000);
    expect(new Set(first.map((vehicle) => vehicle.external_id)).size).toBe(5_000);
    expect(first[0]).toEqual(second[0]);
    expect(first[0]?.lon).not.toBe(first[1]?.lon);
  });

  it("appends a current open alert for the KPI test", () => {
    const alert = appendMockAlert("demo-imei-0002");
    expect(alert.status).toBe("open");
    expect(alert.plate).toBe("LSD-101-AA");
    expect(Date.now() - Date.parse(alert.occurred_at)).toBeLessThan(5_000);
  });
});

import { describe, expect, it } from "vitest";
import { appendMockAlert, freshenVehicles, resetMockState } from "./handlers";
import { vehiclesFixture } from "./fixtures/vehicles";
import { perfVehicles } from "./perf";

const API = `${window.location.origin}/api/v1`;
const vehicleId = vehiclesFixture[0]?.id ?? "";

async function patchVehicle(body: unknown): Promise<Response> {
  return fetch(`${API}/vehicles/${vehicleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

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

describe("mock vehicle PATCH", () => {
  it("rejects an empty patch the way staging does", async () => {
    const response = await patchVehicle({});
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_request", message: "no fields to update" },
    });
  });

  it("treats a null driver as absent and rejects the empty patch", async () => {
    const response = await patchVehicle({ driver_id: null });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_request", message: "no fields to update" },
    });
  });

  it("rejects an unknown administrative status", async () => {
    const response = await patchVehicle({ status: "moving" });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_status" },
    });
  });

  it("joins the driver name and phone when driver_id changes", async () => {
    const response = await patchVehicle({ driver_id: "e1b14124-2507-4cc4-be1d-3bc4247ebbf7" });
    expect(response.status).toBe(204);

    const detail = await fetch(`${API}/vehicles/${vehicleId}`);
    const payload = (await detail.json()) as {
      data: { driver_id: string; driver_name: string; driver_phone: string };
    };
    expect(payload.data).toMatchObject({
      driver_id: "e1b14124-2507-4cc4-be1d-3bc4247ebbf7",
      driver_name: "Adebayo Okafor",
      driver_phone: "08031000010",
    });
  });

  it("forbids a viewer", async () => {
    localStorage.setItem("fleet.mockRole", "viewer"); // guard-ignore: test-only mock role override.
    resetMockState();
    const response = await patchVehicle({ depot: "Apapa Depot" });
    expect(response.status).toBe(403);
  });

  it("returns a real-shaped unknown event for the unknown_enum fault", async () => {
    const response = await fetch(
      `${API}/vehicles/${vehicleId}/events?fault=vehicle-events%3Aunknown_enum`,
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: Array<{ kind: string; type: string }> };
    expect(payload.data.some((event) => event.kind === "solar_flare")).toBe(true);
    expect(payload.data.every((event) => typeof event.kind === "string")).toBe(true);
  });
});

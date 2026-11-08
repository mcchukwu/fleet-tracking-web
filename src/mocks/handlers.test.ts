import { describe, expect, it } from "vitest";
import { appendMockAlert, freshenVehicles, resetMockState } from "./handlers";
import { vehiclesFixture } from "./fixtures/vehicles";
import { alertsFixture } from "./fixtures/alerts";
import { perfVehicles } from "./perf";

const API = `${window.location.origin}/api/v1`;
const vehicleId = vehiclesFixture[0]?.id ?? "";
const openAlert = alertsFixture.find((alert) => alert.status === "open");
const ackedAlert = alertsFixture.find((alert) => alert.status === "acked");
const speedingRule = "c8f53fb1-7479-4d1d-87f5-fce3cfce8c02";

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

  it("accepts write-only device fields without storing them", async () => {
    const response = await patchVehicle({
      sim_number: "892340000000001",
      device_model: "Teltonika FMB920",
      protocol: "teltonika",
    });
    expect(response.status).toBe(204);

    const detail = await fetch(`${API}/vehicles/${vehicleId}`);
    const payload = (await detail.json()) as { data: Record<string, unknown> };
    expect(payload.data).not.toHaveProperty("sim_number");
    expect(payload.data).not.toHaveProperty("device_model");
    expect(payload.data).not.toHaveProperty("protocol");
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

describe("mock alerts", () => {
  it("applies limit and offset and returns newest first", async () => {
    const response = await fetch(`${API}/alerts?limit=2&offset=1`);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: Array<{ id: string; occurred_at: string }> };
    expect(payload.data).toHaveLength(2);
    expect(payload.data[0]?.id).toBe(alertsFixture[1]?.id);
    expect(Date.parse(payload.data[0]?.occurred_at ?? "")).toBeGreaterThanOrEqual(
      Date.parse(payload.data[1]?.occurred_at ?? ""),
    );
  });

  it("acknowledges an open alert and refuses a second ack", async () => {
    const first = await fetch(`${API}/alerts/${openAlert?.id}/ack`, { method: "POST" });
    expect(first.status).toBe(204);

    const second = await fetch(`${API}/alerts/${openAlert?.id}/ack`, { method: "POST" });
    expect(second.status).toBe(404);
    await expect(second.json()).resolves.toMatchObject({
      error: { code: "not_found", message: "open alert not found" },
    });
  });

  it("cannot acknowledge an alert that was never open", async () => {
    const response = await fetch(`${API}/alerts/${ackedAlert?.id}/ack`, { method: "POST" });
    expect(response.status).toBe(404);
  });

  it("forbids a viewer from acknowledging and lets security acknowledge", async () => {
    localStorage.setItem("fleet.mockRole", "viewer"); // guard-ignore: test-only mock role override.
    resetMockState();
    const forbiddenResponse = await fetch(`${API}/alerts/${openAlert?.id}/ack`, {
      method: "POST",
    });
    expect(forbiddenResponse.status).toBe(403);

    localStorage.setItem("fleet.mockRole", "security"); // guard-ignore: test-only mock role override.
    resetMockState();
    const securityResponse = await fetch(`${API}/alerts/${openAlert?.id}/ack`, {
      method: "POST",
    });
    expect(securityResponse.status).toBe(204);
  });

  it("seeds a large page for the Load more test", async () => {
    const response = await fetch(`${API}/__mock/alerts/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 500 }),
    });
    expect(response.status).toBe(200);
    const page = await fetch(`${API}/alerts?limit=500`);
    const payload = (await page.json()) as { data: unknown[] };
    expect(payload.data).toHaveLength(500);
  });
});

describe("mock alert rules", () => {
  it("replaces the whole config object", async () => {
    const before = await fetch(`${API}/alert-rules`);
    const beforePayload = (await before.json()) as {
      data: Array<{ id: string; config: Record<string, unknown> }>;
    };
    expect(beforePayload.data.find((rule) => rule.id === speedingRule)?.config).toEqual({
      speed_kph: 80,
      duration_s: 120,
    });

    const response = await fetch(`${API}/alert-rules/${speedingRule}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: { speed_kph: 81 } }),
    });
    expect(response.status).toBe(204);

    const after = await fetch(`${API}/alert-rules`);
    const afterPayload = (await after.json()) as {
      data: Array<{ id: string; config: Record<string, unknown> }>;
    };
    expect(afterPayload.data.find((rule) => rule.id === speedingRule)?.config).toEqual({
      speed_kph: 81,
    });
  });

  it("rejects a non-boolean enabled flag", async () => {
    const response = await fetch(`${API}/alert-rules/${speedingRule}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: "yes" }),
    });
    expect(response.status).toBe(400);
  });

  it("forbids security and viewers from changing rules", async () => {
    for (const role of ["security", "viewer"]) {
      localStorage.setItem("fleet.mockRole", role); // guard-ignore: test-only mock role override.
      resetMockState();
      const response = await fetch(`${API}/alert-rules/${speedingRule}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      expect(response.status).toBe(403);
    }
  });
});

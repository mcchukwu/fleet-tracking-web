import { describe, expect, it } from "vitest";
import { appendMockAlert, freshenVehicles, resetMockState } from "./handlers";
import { vehiclesFixture } from "./fixtures/vehicles";
import { alertsFixture } from "./fixtures/alerts";
import { perfVehicles } from "./perf";
import { tripsFixture } from "./fixtures/trips";
import { driversFixture } from "./fixtures/drivers";

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

describe("playback mock endpoints", () => {
  const from = encodeURIComponent("2026-11-08T14:00:00Z");
  const to = encodeURIComponent("2026-11-08T14:10:00Z");

  it("generates history at the requested resolution", async () => {
    const response = await fetch(
      `${API}/vehicles/${vehicleId}/history?from=${from}&to=${to}&resolution=30s`,
    );
    const body = (await response.json()) as { data: unknown[]; resolution: string };
    expect(response.status).toBe(200);
    expect(body.resolution).toBe("30s");
    expect(body.data).toHaveLength(21);
  });

  it("rejects a reversed or oversized range with invalid_range", async () => {
    const reversed = await fetch(
      `${API}/vehicles/${vehicleId}/history?from=${to}&to=${from}&resolution=30s`,
    );
    expect(reversed.status).toBe(400);
    expect(await reversed.json()).toMatchObject({ error: { code: "invalid_range" } });
  });

  it("returns a null page for an unknown vehicle", async () => {
    const response = await fetch(
      `${API}/vehicles/00000000-0000-0000-0000-000000000000/history?from=${from}&to=${to}`,
    );
    const body = (await response.json()) as { data: unknown };
    expect(response.status).toBe(200);
    expect(body.data).toBeNull();
  });

  it("shifts events into the requested range and 404s an unknown vehicle", async () => {
    const response = await fetch(`${API}/vehicles/${vehicleId}/events?from=${from}&to=${to}`);
    const body = (await response.json()) as { data: Array<{ at: string }> };
    const times = body.data.map((event) => Date.parse(event.at));
    expect(times.every((time) => time >= Date.parse("2026-11-08T14:00:00Z"))).toBe(true);

    const missing = await fetch(
      `${API}/vehicles/00000000-0000-0000-0000-000000000000/events?from=${from}&to=${to}`,
    );
    expect(missing.status).toBe(404);
  });
});

describe("mock trips", () => {
  const activeDriver = driversFixture.find((driver) => driver.status === "active");
  const vehicleId = vehiclesFixture[0]?.id ?? "";

  async function patchTrip(id: string, body: unknown): Promise<Response> {
    return fetch(`${API}/trips/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("applies status, limit and offset", async () => {
    const response = await fetch(`${API}/trips?limit=2&offset=1`);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: Array<{ id: string }> };
    expect(payload.data.map((row) => row.id)).toEqual([
      tripsFixture[1]?.id,
      tripsFixture[2]?.id,
    ]);

    const active = await fetch(`${API}/trips?status=active`);
    const activePayload = (await active.json()) as { data: Array<{ status: string }> };
    expect(activePayload.data.every((row) => row.status === "active")).toBe(true);

    const unknown = await fetch(`${API}/trips?status=diverted`);
    await expect(unknown.json()).resolves.toEqual({ data: [] });
  });

  it("supports the empty page flag and the trips-shaped unknown enum fault", async () => {
    const empty = await fetch(`${API}/trips?empty=trips`);
    await expect(empty.json()).resolves.toEqual({ data: [] });

    const unknown = await fetch(`${API}/trips?fault=trips%3Aunknown_enum`);
    const payload = (await unknown.json()) as { data: Array<{ status: string }> };
    expect(payload.data[0]?.status).toBe("diverted");
  });

  it("creates a planned trip with a resolved driver and records the write", async () => {
    const response = await fetch(`${API}/trips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicle_id: vehicleId,
        driver_id: activeDriver?.id,
        origin: "Refinery Gate",
        destination: "Ibadan Customer",
      }),
    });
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string };
    expect(created.id).toBeTruthy();

    const list = await fetch(`${API}/trips?limit=500`);
    const payload = (await list.json()) as {
      data: Array<{ id: string; status: string; driver_name?: string; distance_km: number }>;
    };
    const row = payload.data.find((trip) => trip.id === created.id);
    expect(row).toMatchObject({
      status: "planned",
      driver_name: activeDriver?.name,
      distance_km: 0,
    });
  });

  it("rejects a create without the required fields", async () => {
    const response = await fetch(`${API}/trips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicle_id: vehicleId }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_request" },
    });
  });

  it("sets timestamps and a distance on transitions", async () => {
    const target = tripsFixture.find((trip) => trip.status === "active");
    if (!target) throw new Error("fixture missing an active trip");

    const started = await patchTrip(target.id, { status: "active" });
    expect(started.status).toBe(204);

    const completed = await patchTrip(target.id, { status: "completed" });
    expect(completed.status).toBe(204);

    const list = await fetch(`${API}/trips?limit=500`);
    const payload = (await list.json()) as {
      data: Array<{
        id: string;
        status: string;
        started_at?: string;
        ended_at?: string;
        distance_km: number;
      }>;
    };
    const row = payload.data.find((trip) => trip.id === target.id);
    expect(row?.status).toBe("completed");
    expect(row?.started_at).toBeTruthy();
    expect(row?.ended_at).toBeTruthy();
    expect(row?.distance_km).toBe(12.4);
  });

  it("rejects an unknown status and an empty body is a no-op", async () => {
    const target = tripsFixture[1];
    if (!target) throw new Error("fixture missing");

    const unknown = await patchTrip(target.id, { status: "diverted" });
    expect(unknown.status).toBe(400);
    await expect(unknown.json()).resolves.toMatchObject({
      error: { code: "invalid_status" },
    });

    const empty = await patchTrip(target.id, {});
    expect(empty.status).toBe(204);
  });

  it("forbids viewer and security writes and allows the dispatcher", async () => {
    for (const role of ["viewer", "security"]) {
      localStorage.setItem("fleet.mockRole", role); // guard-ignore: test-only mock role override.
      resetMockState();
      const create = await fetch(`${API}/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: vehicleId, origin: "A", destination: "B" }),
      });
      expect(create.status).toBe(403);
      const transition = await patchTrip(tripsFixture[0]?.id ?? "", { status: "cancelled" });
      expect(transition.status).toBe(403);
    }

    localStorage.setItem("fleet.mockRole", "dispatcher"); // guard-ignore: test-only mock role override.
    resetMockState();
    const create = await fetch(`${API}/trips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicle_id: vehicleId, origin: "A", destination: "B" }),
    });
    expect(create.status).toBe(201);
  });

  it("seeds a large page for the Load more test", async () => {
    const response = await fetch(`${API}/__mock/trips/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 105 }),
    });
    expect(response.status).toBe(200);
    const page = await fetch(`${API}/trips?limit=100`);
    const payload = (await page.json()) as { data: unknown[] };
    expect(payload.data).toHaveLength(100);
  });
});

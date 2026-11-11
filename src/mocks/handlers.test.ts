import { afterEach, describe, expect, it } from "vitest";
import { appendMockAlert, applyMockImport, freshenVehicles, resetMockState } from "./handlers";
import { vehiclesFixture } from "./fixtures/vehicles";
import { alertsFixture } from "./fixtures/alerts";
import { perfVehicles } from "./perf";
import { tripsFixture } from "./fixtures/trips";
import { driversFixture } from "./fixtures/drivers";
import { geofencesFixture } from "./fixtures/geofences";

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

describe("mock import", () => {
  it("imports rows, returns null errors and makes the vehicle searchable", async () => {
    const outcome = applyMockImport(
      "imei,plate,make,year\npreview-clean-1,LSD-900-AA,Volvo,2021",
    );
    expect(outcome).toMatchObject({
      ok: true,
      result: { total: 1, imported: 1, failed: 0, errors: null },
    });

    const list = (await (await fetch(`${API}/vehicles?q=preview-clean-1`)).json()) as {
      data: Array<{ plate: string }>;
    };
    expect(list.data).toHaveLength(1);
    expect(list.data[0]?.plate).toBe("LSD-900-AA");
  });

  it("rejects a missing imei header with the real invalid_csv code", () => {
    expect(applyMockImport("plate,make\nLSD-910-AA,Volvo")).toEqual({
      ok: false,
      code: "invalid_csv",
      message: "the header must include imei",
    });
  });

  it("rejects an empty file", () => {
    expect(applyMockImport("")).toEqual({
      ok: false,
      code: "invalid_csv",
      message: "could not read the header row",
    });
  });

  it("reports row errors with the header line counted", () => {
    expect(
      applyMockImport(
        "imei,plate,year\npreview-bad-1,LSD-911-AA,not-a-year\npreview-bad-2,LSD-912-AA,2020",
      ),
    ).toMatchObject({
      ok: true,
      result: {
        total: 2,
        imported: 1,
        failed: 1,
        errors: [{ row: 2, message: "year must be a number" }],
      },
    });
  });

  it("creates the named driver and links it to the vehicle", async () => {
    applyMockImport(
      "imei,plate,driver_name,driver_phone\npreview-driver-1,LSD-913-AA,Import Driver,08030000000",
    );
    const drivers = (await (await fetch(`${API}/drivers`)).json()) as {
      data: Array<{ name: string; phone: string }>;
    };
    const created = drivers.data.find((driver) => driver.name === "Import Driver");
    expect(created?.phone).toBe("08030000000");
  });

  it("forbids a viewer and rejects a request without a file field", async () => {
    localStorage.setItem("fleet.mockRole", "viewer"); // guard-ignore: test-only mock role override.
    resetMockState();
    const form = new FormData();
    form.append("file", new File(["imei\nviewer-row"], "vehicles.csv"));
    expect(
      (
        await fetch(`${API}/import/vehicles`, {
          method: "POST",
          body: form,
        })
      ).status,
    ).toBe(403);

    localStorage.removeItem("fleet.mockRole"); // guard-ignore: test-only mock role override.
    resetMockState();
    const missing = await fetch(`${API}/import/vehicles`, {
      method: "POST",
      body: "",
    });
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toMatchObject({
      error: { code: "invalid_request" },
    });
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

describe("mock drivers", () => {
  const driverId = "5b77edaf-c0c6-4ba4-b0c7-d2b6422c598d";

  async function patchDriver(id: string, body: unknown): Promise<Response> {
    return fetch(`${API}/drivers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns the whole list and ignores the filters staging ignores", async () => {
    resetMockState();
    const response = await fetch(`${API}/drivers?status=active&q=zzz&limit=2&offset=1`);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: Array<{ id: string }> };
    expect(payload.data).toHaveLength(driversFixture.length);
    expect(payload.data.map((driver) => driver.id)).toContain("c7d3e3a6-0b6e-4f2c-9a4e-2b1f6f2d8e19");
  });

  it("supports the empty page flag and a driver-shaped unknown enum", async () => {
    resetMockState();
    const empty = await fetch(`${API}/drivers?empty=drivers`);
    await expect(empty.json()).resolves.toEqual({ data: [] });

    const unknown = await fetch(`${API}/drivers?fault=drivers%3Aunknown_enum`);
    const payload = (await unknown.json()) as { data: Array<{ status: string }> };
    expect(payload.data[0]?.status).toBe("suspended");
  });

  it("creates an active zero-vehicle driver with trimmed and defaulted fields", async () => {
    resetMockState();
    localStorage.setItem("fleet.mockRole", "dispatcher"); // guard-ignore: test-only mock role override.
    window.__FLEET_MOCK_WRITES__ = [];
    const response = await fetch(`${API}/drivers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "  Ada Obi  " }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: expect.any(String) });

    const list = await fetch(`${API}/drivers`);
    const payload = (await list.json()) as {
      data: Array<{ name: string; phone: string; licence: string; status: string; vehicles: number }>;
    };
    const created = payload.data.find((driver) => driver.name === "Ada Obi");
    expect(created).toMatchObject({ phone: "", licence: "", status: "active", vehicles: 0 });
    expect(window.__FLEET_MOCK_WRITES__?.at(-1)).toMatchObject({
      method: "POST",
      url: "/api/v1/drivers",
      body: { name: "  Ada Obi  " },
    });
  });

  it("rejects a blank or missing name the way staging does", async () => {
    resetMockState();
    for (const body of [{ name: "   " }, {}]) {
      const response = await fetch(`${API}/drivers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "invalid_request", message: "name is required" },
      });
    }
  });

  it("rejects an empty body, a blank name and an invalid status on update", async () => {
    resetMockState();
    const empty = await patchDriver(driverId, {});
    expect(empty.status).toBe(400);
    await expect(empty.json()).resolves.toMatchObject({
      error: { code: "invalid_request", message: "no fields to update" },
    });

    const blank = await patchDriver(driverId, { name: "  " });
    expect(blank.status).toBe(400);
    await expect(blank.json()).resolves.toMatchObject({
      error: { code: "invalid_request", message: "name cannot be empty" },
    });

    const invalid = await patchDriver(driverId, { status: "suspended" });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({
      error: { code: "invalid_status", message: "status must be active or inactive" },
    });
  });

  it("returns 404 for an unknown driver", async () => {
    resetMockState();
    const response = await patchDriver("does-not-exist", { phone: "08031000010" });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "not_found", message: "driver not found" },
    });
  });

  it("forbids viewer and security writes and allows a dispatcher", async () => {
    for (const role of ["viewer", "security"]) {
      localStorage.setItem("fleet.mockRole", role); // guard-ignore: test-only mock role override.
      resetMockState();
      const create = await fetch(`${API}/drivers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ada Obi" }),
      });
      expect(create.status).toBe(403);
      const update = await patchDriver(driverId, { phone: "" });
      expect(update.status).toBe(403);
    }

    localStorage.setItem("fleet.mockRole", "dispatcher"); // guard-ignore: test-only mock role override.
    resetMockState();
    const update = await patchDriver(driverId, { phone: "" });
    expect(update.status).toBe(204);
  });

  it("updates the denormalised snapshot fields after a rename or phone change", async () => {
    resetMockState();
    const before = (await (await fetch(`${API}/live/snapshot`)).json()) as {
      data: Array<{ driver_id?: string; driver_name?: string; driver_phone?: string }>;
    };
    expect(before.data.some((vehicle) => vehicle.driver_id === driverId)).toBe(true);

    const response = await patchDriver(driverId, { name: "Adebayo Renamed", phone: "" });
    expect(response.status).toBe(204);
    const after = (await (await fetch(`${API}/live/snapshot`)).json()) as {
      data: Array<{ driver_id?: string; driver_name?: string; driver_phone?: string }>;
    };
    for (const vehicle of after.data.filter((row) => row.driver_id === driverId)) {
      expect(vehicle.driver_name).toBe("Adebayo Renamed");
      expect(vehicle.driver_phone).toBe("");
    }
  });

  it("keeps vehicles assigned when a driver is deactivated", async () => {
    resetMockState();
    const response = await patchDriver(driverId, { status: "inactive" });
    expect(response.status).toBe(204);
    const list = (await (await fetch(`${API}/drivers`)).json()) as {
      data: Array<{ id: string; status: string; vehicles: number }>;
    };
    expect(list.data.find((driver) => driver.id === driverId)).toMatchObject({
      status: "inactive",
      vehicles: 1,
    });
    const snapshot = (await (await fetch(`${API}/live/snapshot`)).json()) as {
      data: Array<{ driver_id?: string }>;
    };
    expect(snapshot.data.some((vehicle) => vehicle.driver_id === driverId)).toBe(true);
  });
});

const squareRing = [
  [3.4, 6.4],
  [3.5, 6.4],
  [3.5, 6.5],
  [3.4, 6.4],
];

async function postGeofence(body: unknown): Promise<Response> {
  return fetch(`${API}/geofences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function patchGeofence(id: string, body: unknown): Promise<Response> {
  return fetch(`${API}/geofences/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function deleteGeofence(id: string): Promise<Response> {
  return fetch(`${API}/geofences/${id}`, { method: "DELETE" });
}

describe("mock geofences", () => {
  it("returns the whole tenant and ignores every query parameter", async () => {
    resetMockState();
    const response = await fetch(`${API}/geofences?q=Refinery&limit=1&offset=2`);
    const payload = (await response.json()) as { data: Array<{ id: string }> };
    expect(payload.data.map((row) => row.id)).toEqual(geofencesFixture.map((row) => row.id));
  });

  it("supports the empty flag and the unknown-kind shape", async () => {
    resetMockState();
    const empty = await fetch(`${API}/geofences?empty=geofences`);
    await expect(empty.json()).resolves.toEqual({ data: [] });

    const unknown = await fetch(`${API}/geofences?fault=geofences%3Aunknown_enum`);
    const payload = (await unknown.json()) as { data: Array<{ kind: string }> };
    expect(payload.data[0]?.kind).toBe("solar");
  });

  it("creates with a default kind of other and records the write", async () => {
    resetMockState();
    window.__FLEET_MOCK_WRITES__ = [];
    const response = await postGeofence({
      name: "  New Gate ",
      geometry: { type: "Polygon", coordinates: [squareRing] },
    });
    expect(response.status).toBe(201);
    const payload = (await response.json()) as { id: string };
    expect(payload.id).toBeTruthy();
    expect(window.__FLEET_MOCK_WRITES__?.[0]).toMatchObject({
      method: "POST",
      url: "/api/v1/geofences",
    });

    const list = (await (await fetch(`${API}/geofences`)).json()) as {
      data: Array<{ id: string; name: string; kind: string }>;
    };
    const row = list.data.find((item) => item.id === payload.id);
    expect(row).toMatchObject({ name: "  New Gate ", kind: "other" });
  });

  it("rejects a blank name, an unknown kind and an invalid ring", async () => {
    resetMockState();
    const blank = await postGeofence({
      name: "   ",
      geometry: { type: "Polygon", coordinates: [squareRing] },
    });
    expect(blank.status).toBe(400);
    await expect(blank.json()).resolves.toMatchObject({
      error: { code: "invalid_request", message: "name and geometry are required" },
    });

    const kind = await postGeofence({
      name: "Gate",
      kind: "solar",
      geometry: { type: "Polygon", coordinates: [squareRing] },
    });
    expect(kind.status).toBe(400);
    await expect(kind.json()).resolves.toMatchObject({
      error: { code: "invalid_kind" },
    });

    const bowTie = await postGeofence({
      name: "Gate",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [3.4, 6.4],
            [3.5, 6.5],
            [3.5, 6.4],
            [3.4, 6.5],
          ],
        ],
      },
    });
    expect(bowTie.status).toBe(400);
    await expect(bowTie.json()).resolves.toMatchObject({
      error: { code: "invalid_geometry", message: "geometry must be a valid polygon" },
    });
  });

  it("patches only the supplied fields and rejects an empty body", async () => {
    resetMockState();
    const id = geofencesFixture[1]?.id ?? "";
    const nameOnly = await patchGeofence(id, { name: "Ibadan Gate" });
    expect(nameOnly.status).toBe(204);

    const list = (await (await fetch(`${API}/geofences`)).json()) as {
      data: Array<{ id: string; name: string; kind: string }>;
    };
    expect(list.data.find((row) => row.id === id)).toMatchObject({
      name: "Ibadan Gate",
      kind: "customer",
    });

    const empty = await patchGeofence(id, {});
    expect(empty.status).toBe(400);
    await expect(empty.json()).resolves.toMatchObject({
      error: { code: "invalid_request", message: "name, geometry or kind is required" },
    });
  });

  it("mirrors the invalid-PATCH-geometry quirk and the missing-geofence error", async () => {
    resetMockState();
    const id = geofencesFixture[2]?.id ?? "";
    const invalidRing = await patchGeofence(id, {
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [3.4, 6.4],
            [3.5, 6.5],
            [3.5, 6.4],
            [3.4, 6.5],
          ],
        ],
      },
    });
    expect(invalidRing.status).toBe(404);
    await expect(invalidRing.json()).resolves.toMatchObject({
      error: { code: "not_found", message: "geofence not found" },
    });

    const line = await patchGeofence(id, {
      geometry: { type: "LineString", coordinates: squareRing },
    });
    expect(line.status).toBe(400);
    await expect(line.json()).resolves.toMatchObject({
      error: { code: "invalid_geometry", message: "could not update geofence" },
    });

    const missing = await patchGeofence("does-not-exist", { name: "Gate" });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({
      error: { code: "not_found", message: "geofence not found" },
    });
  });

  it("deletes a free geofence and refuses one with events", async () => {
    resetMockState();
    const free = geofencesFixture[1]?.id ?? "";
    const response = await deleteGeofence(free);
    expect(response.status).toBe(204);
    const list = (await (await fetch(`${API}/geofences`)).json()) as {
      data: Array<{ id: string }>;
    };
    expect(list.data.some((row) => row.id === free)).toBe(false);

    const refinery = "00000000-0000-0000-0000-000000000201";
    const blocked = await deleteGeofence(refinery);
    expect(blocked.status).toBe(409);
    await expect(blocked.json()).resolves.toMatchObject({
      error: {
        code: "in_use",
        message: "geofence has events and cannot be deleted",
      },
    });

    const missing = await deleteGeofence("does-not-exist");
    expect(missing.status).toBe(404);
  });

  it("forbids viewer and security writes and allows a dispatcher", async () => {
    for (const role of ["viewer", "security"]) {
      localStorage.setItem("fleet.mockRole", role); // guard-ignore: test-only mock role override.
      resetMockState();
      const create = await postGeofence({
        name: "Gate",
        geometry: { type: "Polygon", coordinates: [squareRing] },
      });
      expect(create.status).toBe(403);
      expect((await deleteGeofence(geofencesFixture[1]?.id ?? "")).status).toBe(403);
    }

    localStorage.setItem("fleet.mockRole", "dispatcher"); // guard-ignore: test-only mock role override.
    resetMockState();
    const create = await postGeofence({
      name: "Gate",
      geometry: { type: "Polygon", coordinates: [squareRing] },
    });
    expect(create.status).toBe(201);
  });
});

describe("mock reports", () => {
  afterEach(() => {
    localStorage.removeItem("fleet.mockReports"); // guard-ignore: test-only mock scenario.
  });

  it("echoes the requested range and serves the default fixture", async () => {
    const response = await fetch(
      `${API}/reports/summary?from=2026-11-01T00%3A00%3A00Z&to=2026-11-08T00%3A00%3A00Z`,
    );
    await expect(response.json()).resolves.toMatchObject({
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-08T00:00:00Z",
      trips: 5,
    });
  });

  it("selects the zero, large and no-breakdown scenarios", async () => {
    localStorage.setItem("fleet.mockReports", "zero"); // guard-ignore: test-only mock scenario.
    let body = (await (await fetch(`${API}/reports/summary`)).json()) as {
      trips: number;
      alerts_by_type: unknown[];
    };
    expect(body.trips).toBe(0);
    expect(body.alerts_by_type).toEqual([]);

    localStorage.setItem("fleet.mockReports", "large"); // guard-ignore: test-only mock scenario.
    body = (await (await fetch(`${API}/reports/summary`)).json()) as typeof body;
    expect(body.trips).toBe(15_430);

    localStorage.setItem("fleet.mockReports", "no-breakdown"); // guard-ignore: test-only mock scenario.
    const noBreakdown = (await (await fetch(`${API}/reports/summary`)).json()) as {
      alerts: number;
      alerts_by_type: unknown[];
    };
    expect(noBreakdown.alerts).toBe(66);
    expect(noBreakdown.alerts_by_type).toEqual([]);

    localStorage.setItem("fleet.mockReports", "bad-row"); // guard-ignore: test-only mock scenario.
    const badRow = (await (await fetch(`${API}/reports/summary`)).json()) as {
      alerts_by_type: unknown[];
    };
    expect(badRow.alerts_by_type).toHaveLength(2);

    localStorage.setItem("fleet.mockReports", "huge"); // guard-ignore: test-only mock scenario.
    const huge = (await (await fetch(`${API}/reports/summary`)).json()) as {
      alerts: number;
      alerts_by_type: { count: number }[];
    };
    expect(huge.alerts).toBe(1_284_945);
    expect(huge.alerts_by_type[0]?.count).toBe(1_284_933);
  });
});

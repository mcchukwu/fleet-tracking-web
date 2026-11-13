import { beforeAll, describe, expect, it } from "vitest";
import { FleetApiClient } from "./client";
import {
  errorResponseSchema,
  historyResponseSchema,
  importResultSchema,
  parseSnapshot,
  parseVehicleEventsResponse,
  systemHealthSchema,
} from "./schemas";

/**
 * Staging contract drift check.
 *
 * Run with `npm run contract:check` and a real admin account:
 *   FLEET_STAGING_EMAIL=admin@demo.ftb FLEET_STAGING_PASSWORD=… npm run contract:check
 *
 * The check is read-only except for one header-only CSV upload, which creates a
 * zero-row import job. It never prints a cookie, CSRF token or credential.
 */

const BASE_URL = (
  process.env.FLEET_STAGING_BASE_URL ?? "https://fleet-demo.165-232-96-216.sslip.io"
).replace(/\/$/, "");
const EMAIL = process.env.FLEET_STAGING_EMAIL;
const PASSWORD = process.env.FLEET_STAGING_PASSWORD;

const missing = [
  ["FLEET_STAGING_EMAIL", EMAIL],
  ["FLEET_STAGING_PASSWORD", PASSWORD],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

function createCookieFetch(): typeof fetch {
  const jar = new Map<string, string>();
  const cookieFetch: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (jar.size > 0) {
      headers.set(
        "Cookie",
        [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; "),
      );
    }
    const response = await fetch(input, { ...init, headers });
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(";")[0] ?? "";
      const separator = pair.indexOf("=");
      if (separator > 0) {
        jar.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
      }
    }
    return response;
  };
  return cookieFetch;
}

function sessionClient(): { client: FleetApiClient; fetcher: typeof fetch } {
  const fetcher = createCookieFetch();
  return { client: new FleetApiClient(BASE_URL, fetcher), fetcher };
}

const hour = 60 * 60 * 1000;
const now = new Date();
const from = new Date(now.getTime() - 24 * hour).toISOString();
const to = now.toISOString();

if (missing.length > 0) {
  describe("staging contract check", () => {
    it("requires staging credentials", () => {
      throw new Error(
        `Missing ${missing.join(", ")}. Set FLEET_STAGING_EMAIL and FLEET_STAGING_PASSWORD (admin) before running npm run contract:check.`,
      );
    });
  });
}

describe.skipIf(missing.length > 0)("staging contract check", () => {
  const session = sessionClient();
  const client = session.client;
  let userId = "";

  beforeAll(async () => {
    const login = await client.login(EMAIL ?? "", PASSWORD ?? "");
    userId = login.user.id;
  });

  it("logs in and restores the session with a real CSRF token", async () => {
    const me = await client.me();
    expect(me.user.id).toBe(userId);
    expect(me.user.email).toBe(EMAIL);
    expect(me.csrf_token.length).toBeGreaterThan(20);
  });

  it("validates the snapshot, the vehicle list and one vehicle record", async () => {
    const snapshot = await client.liveSnapshot();
    const parsedSnapshot = parseSnapshot({ data: snapshot.data });
    expect(parsedSnapshot.vehicles.length).toBeGreaterThan(0);

    const vehicles = await client.vehicles({ limit: 2 });
    const parsedVehicles = parseSnapshot(vehicles);
    expect(parsedVehicles.vehicles.length).toBeGreaterThan(0);

    const first = parsedSnapshot.vehicles[0];
    expect(first).toBeDefined();
    if (!first) return;
    const vehicle = await client.vehicle(first.id);
    expect(vehicle.data.id).toBe(first.id);
  });

  it("validates vehicle events and history", async () => {
    const snapshot = await client.liveSnapshot();
    const first = parseSnapshot({ data: snapshot.data }).vehicles[0];
    expect(first).toBeDefined();
    if (!first) return;

    const events = await client.vehicleEvents(first.id, { from });
    const parsedEvents = parseVehicleEventsResponse({ data: events.data });
    expect(parsedEvents.events.length).toBe(events.data.length);

    const history = await client.history(first.id, { from, to, resolution: "30s" });
    const parsedHistory = historyResponseSchema.parse(history);
    expect(parsedHistory.resolution.length).toBeGreaterThan(0);
    expect(Array.isArray(parsedHistory.data)).toBe(true);
  });

  it("validates geofences, trips, alerts and alert rules", async () => {
    const geofences = await client.geofences();
    expect(Array.isArray(geofences.data)).toBe(true);
    for (const geofence of geofences.data) {
      expect(geofence.geometry.coordinates.length).toBeGreaterThan(0);
    }

    const trips = await client.trips({ limit: 2 });
    expect(Array.isArray(trips.data)).toBe(true);

    const alerts = await client.alerts({ limit: 2 });
    expect(Array.isArray(alerts.data)).toBe(true);

    const rules = await client.alertRules();
    expect(Array.isArray(rules.data)).toBe(true);
  });

  it("validates drivers, the report summary, system health and audit", async () => {
    const drivers = await client.drivers();
    expect(Array.isArray(drivers.data)).toBe(true);

    const summary = await client.reportSummary(from, to);
    expect(summary.vehicles).toBeGreaterThanOrEqual(0);
    expect(summary.open_alerts).toBeGreaterThanOrEqual(0);

    const health = await client.systemHealth();
    systemHealthSchema.parse(health);
    expect(health.dependencies).toBeTypeOf("object");

    const audit = await client.audit({ limit: 2, offset: 0 });
    expect(Array.isArray(audit.data)).toBe(true);
  });

  it("validates the header-only import response", async () => {
    const file = new File(["imei\n"], "contract-header-only.csv", { type: "text/csv" });
    const result = await client.importVehicles(file);
    importResultSchema.parse(result);
    expect(result.total).toBe(0);
    expect(result.imported).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toBeNull();
  });

  it("normalises the 401 and 403 error envelopes", async () => {
    const unauthenticated = sessionClient();
    const unauthorized = await unauthenticated.fetcher(`${BASE_URL}/api/v1/live/snapshot`);
    expect(unauthorized.status).toBe(401);
    errorResponseSchema.parse(await unauthorized.json());

    const form = new FormData();
    form.append("file", new File(["imei\n"], "contract-no-csrf.csv", { type: "text/csv" }));
    const forbidden = await session.fetcher(`${BASE_URL}/api/v1/import/vehicles`, {
      method: "POST",
      body: form,
    });
    expect(forbidden.status).toBe(403);
    const envelope = errorResponseSchema.parse(await forbidden.json());
    expect(envelope.error.code).toBe("csrf_failed");
  });
});

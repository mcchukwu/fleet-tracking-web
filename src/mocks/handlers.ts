import { http, HttpResponse } from "msw";
import { z } from "zod";
import { can } from "../auth/roles";
import type {
  Alert,
  AlertRule,
  Driver,
  Geofence,
  Trip,
  User,
  Vehicle,
} from "../api/types";
import { alertRulesFixture } from "./fixtures/alertRules";
import { alertsFixture } from "./fixtures/alerts";
import { driversFixture } from "./fixtures/drivers";
import { vehicleEventsFixture } from "./fixtures/events";
import { geofencesFixture } from "./fixtures/geofences";
import { historyFixture } from "./fixtures/history";
import { tripsFixture } from "./fixtures/trips";
import {
  auditResponseFixture,
  importResultFixture,
  reportSummaryFixture,
  systemHealthFixture,
} from "./fixtures/untyped";
import { vehiclesFixture } from "./fixtures/vehicles";
import { perfVehicles } from "./perf";
import { withFault } from "./faults";

const API = "/api/v1";

interface MockWrite {
  method: string;
  url: string;
  body: unknown;
}

declare global {
  interface Window {
    __FLEET_MOCK_WRITES__?: MockWrite[];
  }
}

/** Dev-and-mock only: lets e2e assert the exact body a write sent. */
function recordMockWrite(method: string, url: string, body: unknown): void {
  if (typeof window === "undefined") return;
  window.__FLEET_MOCK_WRITES__ ??= [];
  window.__FLEET_MOCK_WRITES__.push({ method, url, body });
}

const demoUsers: Record<string, User> = {
  "admin@demo.ftb": {
    id: "00000000-0000-0000-0000-000000000101",
    tenant_id: "tenant-demo",
    email: "admin@demo.ftb",
    name: "Demo Admin",
    role: "admin",
  },
  "dispatcher@demo.ftb": {
    id: "00000000-0000-0000-0000-000000000102",
    tenant_id: "tenant-demo",
    email: "dispatcher@demo.ftb",
    name: "Demo Dispatcher",
    role: "dispatcher",
  },
  "security@demo.ftb": {
    id: "00000000-0000-0000-0000-000000000103",
    tenant_id: "tenant-demo",
    email: "security@demo.ftb",
    name: "Demo Security",
    role: "security",
  },
  "viewer@demo.ftb": {
    id: "00000000-0000-0000-0000-000000000104",
    tenant_id: "tenant-demo",
    email: "viewer@demo.ftb",
    name: "Demo Viewer",
    role: "viewer",
  },
};

interface MockState {
  user: User;
  csrf: string;
  vehicles: Vehicle[];
  alerts: Alert[];
  alertRules: AlertRule[];
  trips: Trip[];
  geofences: Geofence[];
  drivers: Driver[];
}

function createState(): MockState {
  return {
    user: demoUsers["dispatcher@demo.ftb"] ?? Object.values(demoUsers)[0] ?? {
      id: "demo",
      tenant_id: "tenant-demo",
      email: "dispatcher@demo.ftb",
      name: "Demo Dispatcher",
      role: "dispatcher",
    },
    csrf: "mock-csrf-token",
    vehicles: structuredClone(vehiclesFixture),
    alerts: structuredClone(alertsFixture),
    alertRules: structuredClone(alertRulesFixture),
    trips: structuredClone(tripsFixture),
    geofences: structuredClone(geofencesFixture),
    drivers: structuredClone(driversFixture),
  };
}

let state = createState();

export function resetMockState(userEmail = "dispatcher@demo.ftb"): void {
  state = createState();
  state.user = demoUsers[userEmail] ?? state.user;
}

export function mockCurrentUser(): User {
  return resolveUser() ?? state.user;
}

/** Keeps the list and map honest in mock mode: online vehicles have just reported. */
export function freshenVehicles(vehicles: readonly Vehicle[], now = Date.now()): Vehicle[] {
  return vehicles.map((vehicle, index) =>
    vehicle.online
      ? {
          ...vehicle,
          recorded_at: new Date(now - (index % 20) * 1_000).toISOString(),
          speed_kph: vehicle.speed_kph ?? 48,
          heading_deg: vehicle.heading_deg ?? 90,
        }
      : vehicle,
  );
}

export function appendMockAlert(vehicleId?: string): Alert {
  const vehicle = vehicleId
    ? state.vehicles.find((item) => item.id === vehicleId || item.external_id === vehicleId)
    : state.vehicles[0];
  if (!vehicle) throw new Error("The mock has no vehicles");
  const alert: Alert = {
    id: `mock-alert-${Date.now()}`,
    vehicle_id: vehicle.id,
    plate: vehicle.plate,
    type: "geofence_exit",
    severity: "high",
    status: "open",
    occurred_at: new Date().toISOString(),
    evidence: { mock: true },
  };
  state.alerts = [alert, ...state.alerts];
  return alert;
}

const MOCK_SESSION_KEY = "fleet.mockSession";
const MOCK_ROLE_KEY = "fleet.mockRole";
const MOCK_AUTH_KEY = "fleet.mockAuth";
const DEFAULT_EMAIL = "dispatcher@demo.ftb";

function resolveUser(): User | null {
  if (readOverride(MOCK_AUTH_KEY) === "anonymous") return null;
  const role = readOverride(MOCK_ROLE_KEY);
  if (role) {
    const user = demoUsers[`${role}@demo.ftb`];
    if (user) return user;
  }
  const session = readOverride(MOCK_SESSION_KEY);
  if (session === "none") return null;
  if (session && demoUsers[session]) return demoUsers[session];
  return demoUsers[DEFAULT_EMAIL] ?? null;
}

function writeOverride(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value); // guard-ignore: mock-only session override.
  } catch {
    // The mock keeps working without persistence.
  }
}

function clearOverride(key: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key); // guard-ignore: mock-only session override.
  } catch {
    // The mock keeps working without persistence.
  }
}

const loginSchema = z.object({ email: z.string(), password: z.string() });
const vehiclePatchSchema = z
  .object({
    plate: z.string().optional(),
    driver_id: z.string().optional(),
    status: z.string().optional(),
    vehicle_type: z.string().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    year: z.number().optional(),
    colour: z.string().optional(),
    depot: z.string().optional(),
    department: z.string().optional(),
    sim_number: z.string().optional(),
    device_model: z.string().optional(),
    protocol: z.string().optional(),
  })
  .strict();
const tripInputSchema = z.object({
  vehicle_id: z.string(),
  driver_id: z.string().optional(),
  origin: z.string(),
  destination: z.string(),
  status: z.enum(["planned", "assigned", "active", "completed", "cancelled"]).optional(),
});
const tripUpdateSchema = z.record(z.string(), z.unknown());
const geofenceInputSchema = z.object({
  name: z.string(),
  kind: z.enum(["depot", "customer", "restricted", "other"]).optional(),
  geometry: z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.array(z.number()))) }),
});
const driverInputSchema = z.object({
  name: z.string(),
  phone: z.string().optional(),
  licence: z.string().optional(),
});
const alertRuleUpdateSchema = z.record(z.string(), z.unknown());

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function readOverride(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key); // guard-ignore: mock-only test override, never app state.
  } catch {
    return null;
  }
}

function badRequest(): Response {
  return HttpResponse.json(
    { error: { code: "invalid_input", message: "Check the request body." } },
    { status: 400 },
  );
}

function forbidden(): Response {
  return HttpResponse.json({ error: { code: "forbidden", message: "forbidden" } }, { status: 403 });
}

export const handlers = [
  http.post(`${API}/auth/login`, ({ request }) => {
    return withFault("login", request, async () => {
      const parsed = loginSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        return HttpResponse.json(
          { error: { code: "invalid_request", message: "email and password are required" } },
          { status: 400 },
        );
      }
      const user = demoUsers[parsed.data.email];
      if (!user || parsed.data.password !== "DemoPass123!") {
        return HttpResponse.json(
          { error: { code: "invalid_credentials", message: "invalid email or password" } },
          { status: 401 },
        );
      }
      state.user = user;
      clearOverride(MOCK_AUTH_KEY);
      clearOverride(MOCK_ROLE_KEY);
      writeOverride(MOCK_SESSION_KEY, parsed.data.email);
      return HttpResponse.json({ user, csrf_token: state.csrf });
    });
  }),

  http.post(`${API}/auth/logout`, ({ request }) => {
    return withFault("logout", request, () => {
      if (request.headers.get("X-CSRF-Token") !== state.csrf) {
        return HttpResponse.json(
          { error: { code: "csrf_failed", message: "csrf validation failed" } },
          { status: 403 },
        );
      }
      writeOverride(MOCK_SESSION_KEY, "none");
      clearOverride(MOCK_ROLE_KEY);
      clearOverride(MOCK_AUTH_KEY);
      state.user = demoUsers[DEFAULT_EMAIL] ?? state.user;
      return new HttpResponse(null, { status: 204 });
    });
  }),

  http.get(`${API}/me`, ({ request }) => {
    return withFault("me", request, () => {
      const user = resolveUser();
      if (!user) {
        return HttpResponse.json(
          { error: { code: "unauthorized", message: "login required" } },
          { status: 401 },
        );
      }
      state.user = user;
      return HttpResponse.json({ user, csrf_token: state.csrf });
    });
  }),

  http.get(`${API}/vehicles`, ({ request }) => {
    return withFault("vehicles", request, () => {
      const url = new URL(request.url);
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const status = url.searchParams.get("status");
      const data = state.vehicles.filter((vehicle) => {
        const matchesQuery =
          !q ||
          vehicle.plate.toLowerCase().replace(/[\s-]/g, "").includes(q.replace(/[\s-]/g, "")) ||
          vehicle.external_id.toLowerCase().includes(q);
        return matchesQuery && (!status || vehicle.status === status);
      });
      return HttpResponse.json({ data: freshenVehicles(data) });
    });
  }),

  http.get(`${API}/vehicles/:id`, ({ params, request }) => {
    return withFault("vehicle", request, () => {
      const vehicle = state.vehicles.find(
        (item) => item.id === params.id || item.external_id === params.id,
      );
      return vehicle
        ? HttpResponse.json({ data: vehicle })
        : HttpResponse.json({ error: { code: "not_found", message: "not found" } }, { status: 404 });
    });
  }),

  http.patch(`${API}/vehicles/:id`, async ({ params, request }) => {
    return withFault("vehicle", request, async () => {
      const user = resolveUser();
      if (!user || !can(user.role, "mutate")) {
        return HttpResponse.json(
          { error: { code: "forbidden", message: "your role cannot perform this action" } },
          { status: 403 },
        );
      }
      const vehicle = state.vehicles.find(
        (item) => item.id === params.id || item.external_id === params.id,
      );
      if (!vehicle) {
        return HttpResponse.json({ error: { code: "not_found", message: "vehicle not found" } }, { status: 404 });
      }

      const raw = await readJson(request);
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        return HttpResponse.json(
          { error: { code: "invalid_request", message: "invalid body" } },
          { status: 400 },
        );
      }
      // The real API treats null as absent, so {"driver_id": null} is an empty patch.
      const body = Object.fromEntries(
        Object.entries(raw).filter(([, value]) => value !== null && value !== undefined),
      );
      if (Object.keys(body).length === 0) {
        return HttpResponse.json(
          { error: { code: "invalid_request", message: "no fields to update" } },
          { status: 400 },
        );
      }
      const parsed = vehiclePatchSchema.safeParse(body);
      if (!parsed.success) {
        return HttpResponse.json(
          { error: { code: "invalid_request", message: "invalid body" } },
          { status: 400 },
        );
      }
      const update = parsed.data;
      recordMockWrite("PATCH", `${API}/vehicles/${String(params.id)}`, update);
      if (
        update.status !== undefined &&
        !["active", "maintenance", "inactive"].includes(update.status)
      ) {
        return HttpResponse.json(
          {
            error: {
              code: "invalid_status",
              message: "status must be active, maintenance or inactive",
            },
          },
          { status: 400 },
        );
      }

      if (update.driver_id !== undefined) {
        const driver = state.drivers.find((item) => item.id === update.driver_id);
        if (!driver) {
          return HttpResponse.json(
            { error: { code: "not_found", message: "driver not found" } },
            { status: 404 },
          );
        }
        Object.assign(vehicle, {
          driver_id: driver.id,
          driver_name: driver.name,
          driver_phone: driver.phone,
        });
      }
      const {
        driver_id: _driverId,
        sim_number: _simNumber,
        device_model: _deviceModel,
        protocol: _protocol,
        ...fields
      } = update;
      Object.assign(vehicle, fields);
      return new HttpResponse(null, { status: 204 });
    });
  }),

  http.get(`${API}/vehicles/:id/events`, ({ params, request }) => {
    const fault = new URL(request.url).searchParams.get("fault");
    if (fault === "vehicle-events:unknown_enum") {
      return HttpResponse.json({
        data: [
          ...vehicleEventsFixture,
          {
            kind: "solar_flare",
            type: "unmapped_event",
            severity: "extreme",
            status: "pending",
            at: "2026-11-02T21:00:00Z",
            evidence: { source: "future" },
          },
        ],
      });
    }
    return withFault("vehicle-events", request, () =>
      params.id
        ? HttpResponse.json({ data: vehicleEventsFixture })
        : HttpResponse.json({ data: [] }),
    );
  }),

  http.get(`${API}/vehicles/:id/history`, ({ request }) => {
    return withFault("vehicle-history", request, () => {
      const resolution = new URL(request.url).searchParams.get("resolution") ?? "30s";
      return HttpResponse.json({ data: historyFixture, resolution });
    });
  }),

  http.get(`${API}/live/snapshot`, ({ request }) => {
    return withFault("live-snapshot", request, () => {
      const fromRequest = new URL(request.url).searchParams.get("perf");
      const pageParams =
        typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
      const fromPage = pageParams?.get("perf");
      const perfCount = Number.parseInt(fromRequest ?? fromPage ?? "", 10);
      if (Number.isFinite(perfCount) && perfCount > 0) {
        return HttpResponse.json({ data: perfVehicles(perfCount) });
      }
      if (pageParams?.get("positions") === "none") {
        return HttpResponse.json({
          data: state.vehicles.map((vehicle) => ({
            ...vehicle,
            online: false,
            lat: undefined,
            lon: undefined,
            speed_kph: undefined,
            heading_deg: undefined,
            recorded_at: undefined,
          })),
        });
      }
      return HttpResponse.json({ data: freshenVehicles(state.vehicles) });
    });
  }),

  http.post(`${API}/__mock/alerts`, async ({ request }) => {
    const body = (await readJson(request)) as { vehicle_id?: string } | null;
    return HttpResponse.json({ data: appendMockAlert(body?.vehicle_id) });
  }),

  http.get(`${API}/trips`, ({ request }) => {
    return withFault("trips", request, () => {
      const status = new URL(request.url).searchParams.get("status");
      const data = status ? state.trips.filter((trip) => trip.status === status) : state.trips;
      return HttpResponse.json({ data });
    });
  }),

  http.post(`${API}/trips`, async ({ request }) => {
    return withFault("trips", request, async () => {
      const parsed = tripInputSchema.safeParse(await readJson(request));
      if (!parsed.success) return badRequest();
      const vehicle = state.vehicles.find((item) => item.id === parsed.data.vehicle_id);
      const id = `trip-${state.trips.length + 1}`;
      state.trips = [
        ...state.trips,
        {
          id,
          vehicle_id: parsed.data.vehicle_id,
          plate: vehicle?.plate ?? "—",
          ...(parsed.data.driver_id ? { driver_id: parsed.data.driver_id } : {}),
          origin: parsed.data.origin,
          destination: parsed.data.destination,
          status: parsed.data.status ?? "planned",
          distance_km: 0,
        },
      ];
      return HttpResponse.json({ id });
    });
  }),

  http.patch(`${API}/trips/:id`, async ({ params, request }) => {
    return withFault("trips", request, async () => {
      const trip = state.trips.find((item) => item.id === params.id);
      if (!trip) {
        return HttpResponse.json({ error: { code: "not_found", message: "not found" } }, { status: 404 });
      }
      const parsed = tripUpdateSchema.safeParse(await readJson(request));
      if (!parsed.success) return badRequest();
      Object.assign(trip, parsed.data);
      return new HttpResponse(null, { status: 204 });
    });
  }),

  http.get(`${API}/alerts`, ({ request }) => {
    return withFault("alerts", request, () => {
      const url = new URL(request.url);
      const status = url.searchParams.get("status");
      const type = url.searchParams.get("type");
      const data = state.alerts.filter(
        (alert) => (!status || alert.status === status) && (!type || alert.type === type),
      );
      return HttpResponse.json({ data });
    });
  }),

  http.post(`${API}/alerts/:id/ack`, ({ params, request }) => {
    return withFault("alerts", request, () => {
      const alert = state.alerts.find((item) => item.id === params.id);
      if (!alert) {
        return HttpResponse.json(
          { error: { code: "not_found", message: "This alert no longer exists." } },
          { status: 404 },
        );
      }
      alert.status = "acked";
      alert.acked_at = new Date().toISOString();
      return new HttpResponse(null, { status: 204 });
    });
  }),

  http.get(`${API}/alert-rules`, ({ request }) =>
    withFault("alert-rules", request, () => HttpResponse.json({ data: state.alertRules })),
  ),

  http.patch(`${API}/alert-rules/:id`, async ({ params, request }) => {
    return withFault("alert-rules", request, async () => {
      const rule = state.alertRules.find((item) => item.id === params.id);
      if (!rule) {
        return HttpResponse.json({ error: { code: "not_found", message: "not found" } }, { status: 404 });
      }
      const parsed = alertRuleUpdateSchema.safeParse(await readJson(request));
      if (!parsed.success) return badRequest();
      Object.assign(rule, parsed.data);
      return new HttpResponse(null, { status: 204 });
    });
  }),

  http.get(`${API}/geofences`, ({ request }) => {
    const fault = new URL(request.url).searchParams.get("fault");
    if (fault === "geofences:unknown_enum") {
      const first = state.geofences[0];
      return HttpResponse.json({ data: first ? [{ ...first, kind: "solar" }] : [] });
    }
    return withFault("geofences", request, () => HttpResponse.json({ data: state.geofences }));
  }),

  http.post(`${API}/geofences`, async ({ request }) => {
    return withFault("geofences", request, async () => {
      const parsed = geofenceInputSchema.safeParse(await readJson(request));
      if (!parsed.success) return badRequest();
      const id = `geofence-${state.geofences.length + 1}`;
      state.geofences = [
        ...state.geofences,
        {
          id,
          name: parsed.data.name,
          kind: parsed.data.kind ?? "other",
          geometry: parsed.data.geometry,
        },
      ];
      return HttpResponse.json({ id });
    });
  }),

  http.patch(`${API}/geofences/:id`, async ({ params, request }) => {
    return withFault("geofences", request, async () => {
      const geofence = state.geofences.find((item) => item.id === params.id);
      if (!geofence) {
        return HttpResponse.json({ error: { code: "not_found", message: "not found" } }, { status: 404 });
      }
      const parsed = geofenceInputSchema.partial().safeParse(await readJson(request));
      if (!parsed.success) return badRequest();
      Object.assign(geofence, parsed.data);
      return new HttpResponse(null, { status: 204 });
    });
  }),

  http.delete(`${API}/geofences/:id`, ({ params, request }) => {
    return withFault("geofences", request, () => {
      const geofence = state.geofences.find((item) => item.id === params.id);
      if (!geofence) {
        return HttpResponse.json({ error: { code: "not_found", message: "not found" } }, { status: 404 });
      }
      if (geofence.kind === "restricted") {
        return HttpResponse.json(
          {
            error: {
              code: "geofence_has_events",
              message: "This geofence has recorded events and can't be deleted.",
            },
          },
          { status: 409 },
        );
      }
      state.geofences = state.geofences.filter((item) => item.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    });
  }),

  http.get(`${API}/drivers`, ({ request }) =>
    withFault("drivers", request, () => HttpResponse.json({ data: state.drivers })),
  ),

  http.post(`${API}/drivers`, async ({ request }) => {
    return withFault("drivers", request, async () => {
      const parsed = driverInputSchema.safeParse(await readJson(request));
      if (!parsed.success) return badRequest();
      const id = `driver-${state.drivers.length + 1}`;
      state.drivers = [
        ...state.drivers,
        {
          id,
          name: parsed.data.name,
          phone: parsed.data.phone ?? "",
          licence: parsed.data.licence ?? "",
          status: "active",
          vehicles: 0,
        },
      ];
      return HttpResponse.json({ id });
    });
  }),

  http.patch(`${API}/drivers/:id`, async ({ params, request }) => {
    return withFault("drivers", request, async () => {
      const driver = state.drivers.find((item) => item.id === params.id);
      if (!driver) {
        return HttpResponse.json({ error: { code: "not_found", message: "not found" } }, { status: 404 });
      }
      const parsed = driverInputSchema.partial().extend({ status: z.enum(["active", "inactive"]).optional() }).safeParse(await readJson(request));
      if (!parsed.success) return badRequest();
      Object.assign(driver, parsed.data);
      return new HttpResponse(null, { status: 204 });
    });
  }),

  http.get(`${API}/reports/summary`, ({ request }) => {
    return withFault("reports", request, () => {
      const url = new URL(request.url);
      return HttpResponse.json({
        ...reportSummaryFixture,
        from: url.searchParams.get("from") ?? reportSummaryFixture.from,
        to: url.searchParams.get("to") ?? reportSummaryFixture.to,
      });
    });
  }),

  http.get(`${API}/system/health`, ({ request }) =>
    withFault("system-health", request, () => HttpResponse.json(systemHealthFixture)),
  ),

  http.get(`${API}/audit`, ({ request }) => {
    return withFault("audit", request, () => {
      const user = mockCurrentUser();
      if (user.role !== "admin" && user.role !== "security") return forbidden();
      return HttpResponse.json(auditResponseFixture);
    });
  }),

  http.post(`${API}/import/vehicles`, ({ request }) => {
    return withFault("import", request, () =>
      HttpResponse.json({ ...importResultFixture, job_id: `job-${Date.now()}` }),
    );
  }),
];

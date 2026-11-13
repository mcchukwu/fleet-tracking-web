import { describe, expect, it } from "vitest";
import {
  auditResponseSchema,
  parseAuditResponse,
  historyResponseSchema,
  liveMessageSchema,
  parseAlerts,
  parseGeofences,
  parseSnapshot,
  parseTrips,
  parseVehicleEventsResponse,
  parseReportSummary,
  parseVehicleResponse,
  systemHealthSchema,
  importResultSchema,
  toGeofenceKind,
} from "./schemas";
import {
  systemHealthFixture,
  auditResponseFixture,
  importCleanFixture,
  importCappedFixture,
  importResultFixture,
} from "../mocks/fixtures/untyped";
import {
  handoffAlertFrame,
  malformedLiveFrames,
  openApiAlertFrame,
  positionFrame,
  alertFrame,
} from "../mocks/fixtures/live";
import { liveCaptureFrames, liveCaptureMeta } from "../mocks/fixtures/liveCapture";
import { vehiclesFixture } from "../mocks/fixtures/vehicles";
import { geofencesFixture } from "../mocks/fixtures/geofences";
import { alertsFixture } from "../mocks/fixtures/alerts";

describe("contract schemas", () => {
  it("accepts a real position frame", () => {
    const parsed = liveMessageSchema.safeParse(positionFrame);
    expect(parsed.success).toBe(true);
  });

  it("accepts every frame in the committed 31-second staging capture", () => {
    expect(liveCaptureFrames).toHaveLength(liveCaptureMeta.frameCount);
    for (const frame of liveCaptureFrames) {
      expect(liveMessageSchema.safeParse(frame).success).toBe(true);
    }
    expect(new Set(liveCaptureFrames.map((frame) => frame.vehicle_id)).size).toBe(
      liveCaptureMeta.vehicleCount,
    );
  });

  it("accepts a documented alert frame with unknown keys", () => {
    const parsed = liveMessageSchema.safeParse(alertFrame);
    expect(parsed.success).toBe(true);
  });

  it("accepts both documented alert frame shapes", () => {
    expect(liveMessageSchema.safeParse(handoffAlertFrame).success).toBe(true);
    expect(liveMessageSchema.safeParse(openApiAlertFrame).success).toBe(true);
  });

  it("accepts an alert with an unknown severity instead of dropping the frame", () => {
    expect(liveMessageSchema.safeParse({ ...openApiAlertFrame, severity: "extreme" }).success).toBe(
      true,
    );
  });

  it.each(malformedLiveFrames)("rejects a malformed live frame", (frame) => {
    expect(liveMessageSchema.safeParse(frame).success).toBe(false);
  });

  it("parses the observed system health payload", () => {
    const parsed = systemHealthSchema.safeParse(systemHealthFixture);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ingest.received).toBe(72180);
      expect(parsed.data.dependencies.postgres).toBe(true);
    }
  });

  it("accepts a dependency or ingest key the client does not know yet", () => {
    const parsed = systemHealthSchema.safeParse({
      ...systemHealthFixture,
      dependencies: { postgres: true, postgres_replica: true },
      ingest: { ...systemHealthFixture.ingest, future_counter: 3 },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.dependencies.postgres_replica).toBe(true);
    }
  });

  it("rejects a missing or wrongly typed core health field", () => {
    const { vehicles: _vehicles, ...withoutVehicles } = systemHealthFixture;
    expect(systemHealthSchema.safeParse(withoutVehicles).success).toBe(false);
    expect(
      systemHealthSchema.safeParse({
        ...systemHealthFixture,
        ingest: { ...systemHealthFixture.ingest, received: "many" },
      }).success,
    ).toBe(false);
    expect(
      systemHealthSchema.safeParse({
        ...systemHealthFixture,
        dependencies: { postgres: "up" },
      }).success,
    ).toBe(false);
  });

  it("parses the observed audit payload", () => {
    const parsed = auditResponseSchema.safeParse(auditResponseFixture);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data[0]?.action).toBe("auth.login");
    }
  });

  it("parses every valid audit row and keeps unknown actions and entities", () => {
    const result = parseAuditResponse({
      data: [
        {
          id: 207,
          action: "user.role_change",
          entity: "maintenance_job",
          entity_id: "00000000-0000-0000-0000-000000000101",
          user_name: "Demo Admin",
          metadata: { from: "viewer", to: "admin" },
          created_at: "2026-11-12T02:03:55Z",
        },
        {
          id: "audit-string-id",
          action: "auth.login",
          entity: "user",
          entity_id: "00000000-0000-0000-0000-000000000102",
          user_name: "Demo Security",
          metadata: {},
          created_at: "2026-11-12T00:32:15Z",
        },
      ],
    });

    expect(result.rejected).toBe(0);
    expect(result.entries.map((entry) => entry.id)).toEqual([207, "audit-string-id"]);
    expect(result.entries[0]).toMatchObject({
      action: "user.role_change",
      entity: "maintenance_job",
    });
  });

  it("normalises a missing or null entity id, actor and metadata", () => {
    const result = parseAuditResponse({
      data: [
        {
          id: 1,
          action: "trip.create",
          entity: "trip",
          entity_id: null,
          user_name: null,
          metadata: null,
          created_at: "2026-11-12T02:03:55Z",
        },
        {
          id: 2,
          action: "trip.update",
          entity: "trip",
          created_at: "2026-11-12T01:03:55Z",
        },
      ],
    });

    expect(result.rejected).toBe(0);
    expect(result.entries[0]).toMatchObject({
      entity_id: "",
      user_name: "",
      metadata: {},
    });
    expect(result.entries[1]).toMatchObject({
      entity_id: "",
      user_name: "",
      metadata: {},
    });
  });

  it("drops a malformed audit row and keeps the rest", () => {
    const result = parseAuditResponse({
      data: [
        {
          id: 3,
          action: "auth.login",
          entity: "user",
          entity_id: "u",
          user_name: "Demo",
          metadata: {},
          created_at: "2026-11-12T02:03:55Z",
        },
        { id: 4, action: "auth.login", entity: "user", created_at: "not a date" },
        { nope: true },
      ],
    });

    expect(result.entries).toHaveLength(1);
    expect(result.rejected).toBe(2);
    expect(result.received).toBe(3);
  });

  it("counts a full page before dropping a malformed row", () => {
    const rows: unknown[] = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      action: "auth.login",
      entity: "user",
      entity_id: `u-${index + 1}`,
      user_name: "Demo",
      metadata: {},
      created_at: "2026-11-12T02:03:55Z",
    }));
    rows[42] = { id: 43, action: "auth.login" };

    const result = parseAuditResponse({ data: rows });

    expect(result.received).toBe(100);
    expect(result.entries).toHaveLength(99);
    expect(result.rejected).toBe(1);
  });

  it("rejects a bad audit envelope and a page where every row is invalid", () => {
    expect(() => parseAuditResponse({ rows: [] })).toThrow();
    expect(() => parseAuditResponse({ data: [{ unexpected: true }] })).toThrow(
      "No audit row matched the expected shape",
    );
    expect(parseAuditResponse({ data: [] })).toMatchObject({
      entries: [],
      rejected: 0,
      received: 0,
    });
  });

  it("accepts both null and an array for import errors", () => {
    expect(importResultSchema.safeParse(importResultFixture).success).toBe(true);
    expect(importResultSchema.safeParse({ ...importResultFixture, errors: null }).success).toBe(
      true,
    );
  });

  it("accepts the captured clean and capped import responses", () => {
    expect(importResultSchema.parse(importCleanFixture).errors).toBeNull();
    const capped = importResultSchema.parse(importCappedFixture);
    expect(capped.failed).toBe(105);
    expect(capped.errors).toHaveLength(100);
  });

  it("salvages valid snapshot rows and drops invalid ones", () => {
    const result = parseSnapshot({ data: [vehiclesFixture[0], { unexpected: true }] });
    expect(result.vehicles).toHaveLength(1);
    expect(result.vehicles[0]?.external_id).toBe("demo-imei-0001");
    expect(result.rejected).toBe(1);
  });

  it("keeps a vehicle with an unknown trip status and drops only the status", () => {
    const result = parseSnapshot({
      data: [{ ...vehiclesFixture[0], trip_status: "teleporting" }],
    });
    expect(result.vehicles).toHaveLength(1);
    expect(result.vehicles[0]?.trip_status).toBeUndefined();
    expect(result.rejected).toBe(0);
  });

  it("keeps driver_id and driver_name so the drawer can join assignments", () => {
    const result = parseSnapshot({ data: [vehiclesFixture[0]] });
    expect(result.vehicles[0]?.driver_id).toBe("5b77edaf-c0c6-4ba4-b0c7-d2b6422c598d");
    expect(result.vehicles[0]?.driver_name).toBe("Adebayo Okafor");
  });

  it("accepts a snapshot row without driver_id", () => {
    const { driver_id: _driverId, ...withoutDriver } = vehiclesFixture[0] ?? {};
    expect(vehiclesFixture[0]?.driver_id).toBe("5b77edaf-c0c6-4ba4-b0c7-d2b6422c598d");
    const result = parseSnapshot({ data: [withoutDriver] });
    expect(result.vehicles).toHaveLength(1);
    expect(result.vehicles[0]?.driver_id).toBeUndefined();
  });

  it("rejects a snapshot envelope that is not a data array", () => {
    expect(() => parseSnapshot({ rows: [] })).toThrow();
    expect(() => parseSnapshot({ data: {} })).toThrow();
  });

  it("rejects a snapshot where every row is unusable", () => {
    expect(() => parseSnapshot({ data: [{ nope: true }] })).toThrow();
  });

  it("accepts an empty snapshot", () => {
    expect(parseSnapshot({ data: [] }).vehicles).toEqual([]);
  });

  it("maps unknown geofence kinds to other and repairs nothing in the parser", () => {
    expect(toGeofenceKind("depot")).toBe("depot");
    expect(toGeofenceKind("solar")).toBe("other");
    const result = parseGeofences({
      data: [{ ...geofencesFixture[0], kind: "solar" }, { name: "broken" }],
    });
    expect(result.geofences).toHaveLength(1);
    expect(result.geofences[0]?.kind).toBe("other");
    expect(result.rejected).toBe(1);
  });

  it("rejects a geofence envelope that is not a data array", () => {
    expect(() => parseGeofences(null)).toThrow();
  });

  it("salvages valid alert rows and keeps unknown enums for the neutral fallback", () => {
    const result = parseAlerts({
      data: [
        alertsFixture[0],
        { id: "broken", vehicle_id: "v" },
        { ...alertsFixture[0], id: "unknown-type", type: "solar_flare" },
        { ...alertsFixture[0], id: "unknown-severity", severity: "extreme" },
      ],
    });

    expect(result.alerts).toHaveLength(3);
    expect(result.alerts[0]?.id).toBe(alertsFixture[0]?.id);
    expect(result.alerts[1]?.type).toBe("solar_flare");
    expect(result.alerts[2]?.severity).toBe("extreme");
    expect(result.rejected).toBe(1);
  });

  it("rejects an alert envelope that is not a data array", () => {
    expect(() => parseAlerts({ rows: [] })).toThrow();
    expect(() => parseAlerts({ data: [{ nope: true }] })).toThrow();
  });

  it("normalises a null history page to no points", () => {
    const parsed = historyResponseSchema.parse({ data: null, resolution: "30s" });
    expect(parsed.data).toEqual([]);
    expect(parsed.resolution).toBe("30s");
  });

  it("accepts an empty history array and real points", () => {
    expect(historyResponseSchema.parse({ data: [], resolution: "raw" }).data).toEqual([]);

    const parsed = historyResponseSchema.parse({
      data: [{ t: "2026-11-02T18:00:00Z", lat: 6.45, lon: 3.39, speed_kph: 42, heading_deg: 92 }],
      resolution: "30s",
    });
    expect(parsed.data[0]?.lat).toBe(6.45);
  });

  it("rejects a history point row that breaks the contract", () => {
    expect(() =>
      historyResponseSchema.parse({
        data: [{ t: "2026-11-02T18:00:00Z", lat: "6.45", lon: 3.39 }],
        resolution: "30s",
      }),
    ).toThrow();
  });
});

describe("vehicle detail parser", () => {
  const full = vehiclesFixture.find((vehicle) => vehicle.trip_id);
  const noTrip = vehiclesFixture.find((vehicle) => !vehicle.trip_id);
  const offline = vehiclesFixture.find((vehicle) => !vehicle.online);

  it("parses a full record with a trip", () => {
    const vehicle = parseVehicleResponse({ data: full });
    expect(vehicle.id).toBe(full?.id);
    expect(vehicle.trip_id).toBe(full?.trip_id);
    expect(vehicle.trip_status).toBe("active");
  });

  it("keeps a vehicle with no trip fields", () => {
    const vehicle = parseVehicleResponse({ data: noTrip });
    expect(vehicle.trip_id).toBeUndefined();
    expect(vehicle.trip_status).toBeUndefined();
  });

  it("keeps an offline vehicle with no position keys", () => {
    const vehicle = parseVehicleResponse({ data: offline });
    expect(vehicle.lat).toBeUndefined();
    expect(vehicle.online).toBe(false);
    expect(vehicle.plate).toBe(offline?.plate);
  });

  it("keeps an unknown administrative status and trip status instead of failing", () => {
    const vehicle = parseVehicleResponse({
      data: { ...full, status: "reserved", trip_status: "teleporting" },
    });
    expect(vehicle.status).toBe("reserved");
    expect(vehicle.trip_status).toBeUndefined();
  });

  it("keeps device fields when a write-only record includes them", () => {
    const vehicle = parseVehicleResponse({
      data: { ...full, sim_number: "892340000000001", device_model: "GT06", protocol: "gt06" },
    });
    expect(vehicle).toMatchObject({
      sim_number: "892340000000001",
      device_model: "GT06",
      protocol: "gt06",
    });
  });

  it("rejects a record without the required identity", () => {
    expect(() => parseVehicleResponse({ data: { plate: "X" } })).toThrow();
    expect(() => parseVehicleResponse({ rows: [] })).toThrow();
  });
});

describe("vehicle events parser", () => {
  const events = [
    { kind: "geofence", type: "enter", name: "Refinery Gate", at: "2026-11-02T14:00:00Z" },
    { kind: "geofence", type: "exit", name: "Lekki Depot", at: "2026-11-02T16:00:00Z" },
    {
      kind: "alert",
      type: "route_deviation",
      severity: "high",
      status: "open",
      at: "2026-11-02T15:00:00Z",
      evidence: { distance_m: 2091.58 },
    },
  ];

  it("keeps both event shapes and sorts newest first", () => {
    const result = parseVehicleEventsResponse({ data: events });
    expect(result.events.map((event) => event.type)).toEqual(["exit", "route_deviation", "enter"]);
    expect(result.rejected).toBe(0);
  });

  it("keeps unknown kinds, types, severities and statuses", () => {
    const result = parseVehicleEventsResponse({
      data: [
        {
          kind: "solar_flare",
          type: "unmapped_event",
          severity: "extreme",
          status: "pending",
          at: "2026-11-02T21:00:00Z",
        },
      ],
    });
    expect(result.events[0]).toMatchObject({
      kind: "solar_flare",
      type: "unmapped_event",
      severity: "extreme",
      status: "pending",
    });
  });

  it("drops rows without at, kind or type", () => {
    const result = parseVehicleEventsResponse({
      data: [...events, { kind: "alert", type: "speeding" }, { nope: true }],
    });
    expect(result.events).toHaveLength(3);
    expect(result.rejected).toBe(2);
  });

  it("uses the shared alert fields, so a non-string type is rejected", () => {
    const result = parseVehicleEventsResponse({
      data: [
        { kind: "geofence", type: "enter", at: "2026-11-02T14:00:00Z" },
        { kind: "alert", type: 42, at: "2026-11-02T21:00:00Z" },
      ],
    });
    expect(result.events).toHaveLength(1);
    expect(result.rejected).toBe(1);
  });

  it("rejects an envelope that is not a data array and one where nothing parses", () => {
    expect(() => parseVehicleEventsResponse({ rows: [] })).toThrow();
    expect(() => parseVehicleEventsResponse({ data: [{ nope: true }] })).toThrow();
  });

  it("accepts an empty event list", () => {
    expect(parseVehicleEventsResponse({ data: [] }).events).toEqual([]);
  });
});

describe("trip parser", () => {
  it("accepts real null driver and timestamps and normalises a null distance", () => {
    const result = parseTrips({
      data: [
        {
          id: "trip-1",
          vehicle_id: "vehicle-1",
          plate: "LSD-100-AA",
          driver_id: null,
          driver_name: null,
          origin: " Refinery Gate ",
          destination: "Ibadan Customer",
          status: "planned",
          distance_km: null,
          started_at: null,
          ended_at: null,
        },
      ],
    });

    expect(result.rejected).toBe(0);
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0]).toMatchObject({
      id: "trip-1",
      status: "planned",
      distance_km: 0,
      origin: " Refinery Gate ",
    });
    expect(result.trips[0]).not.toHaveProperty("driver_id");
    expect(result.trips[0]).not.toHaveProperty("started_at");
  });

  it("keeps an unknown status instead of dropping the row", () => {
    const result = parseTrips({
      data: [
        {
          id: "trip-1",
          vehicle_id: "vehicle-1",
          plate: "LSD-100-AA",
          origin: "A",
          destination: "B",
          status: "diverted",
          distance_km: 0,
        },
      ],
    });

    expect(result.trips[0]?.status).toBe("diverted");
  });

  it("drops only structurally invalid rows", () => {
    const result = parseTrips({
      data: [
        {
          id: "trip-1",
          vehicle_id: "v",
          plate: "P",
          origin: "A",
          destination: "B",
          status: "planned",
        },
        { id: "", vehicle_id: "v", plate: "P", origin: "A", destination: "B", status: "planned" },
      ],
    });

    expect(result.trips).toHaveLength(1);
    expect(result.rejected).toBe(1);
  });

  it("throws only when every row is unusable", () => {
    expect(() => parseTrips({ data: [{ nope: true }] })).toThrow(/trip row/i);
    expect(parseTrips({ data: [] })).toEqual({ trips: [], rejected: 0 });
    expect(() => parseTrips({ data: null })).toThrow(/envelope/i);
  });
});

describe("report summary", () => {
  const valid = {
    active_trips: 4,
    alerts: 66,
    alerts_by_type: [
      { key: "geofence_exit", count: 31 },
      { key: "geofence_enter", count: 28 },
      { key: "route_deviation", count: 7 },
    ],
    completed_trips: 1,
    distance_km: 10917.07,
    from: "2026-10-27T08:13:42.114639496Z",
    open_alerts: 45,
    to: "2026-11-03T08:13:42.114639496Z",
    trips: 5,
    vehicles: 25,
  };

  it("accepts the real payload and keeps an unknown alert key", () => {
    const result = parseReportSummary({
      ...valid,
      alerts_by_type: [{ key: "solar_flare", count: 2 }],
    });
    expect(result.summary.alerts_by_type).toEqual([{ key: "solar_flare", count: 2 }]);
    expect(result.rejectedChartRows).toBe(0);
  });

  it("accepts a payload without the from/to echo", () => {
    const { from: _from, to: _to, ...withoutEcho } = valid;
    expect(parseReportSummary(withoutEcho).summary.from).toBeUndefined();
  });

  it("accepts zeros and an empty breakdown", () => {
    const result = parseReportSummary({
      ...valid,
      trips: 0,
      completed_trips: 0,
      active_trips: 0,
      alerts: 0,
      open_alerts: 0,
      distance_km: 0,
      alerts_by_type: [],
    });
    expect(result.summary.alerts_by_type).toEqual([]);
  });

  it("drops a malformed chart row and still parses the summary", () => {
    const result = parseReportSummary({
      ...valid,
      alerts_by_type: [{ key: "speeding", count: 3 }, { key: 4 }, null, { count: 2 }],
    });
    expect(result.summary.alerts_by_type).toEqual([{ key: "speeding", count: 3 }]);
    expect(result.rejectedChartRows).toBe(3);
  });

  it("treats a missing breakdown as no rows", () => {
    const { alerts_by_type: _rows, ...withoutRows } = valid;
    expect(parseReportSummary(withoutRows).summary.alerts_by_type).toEqual([]);
  });

  it("rejects a malformed core number as a contract error", () => {
    expect(() => parseReportSummary({ ...valid, trips: "many" })).toThrow(
      "Report summary did not match the expected shape",
    );
    expect(() => parseReportSummary({ data: [] })).toThrow();
  });
});

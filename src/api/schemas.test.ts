import { describe, expect, it } from "vitest";
import {
  auditResponseSchema,
  historyResponseSchema,
  liveMessageSchema,
  parseAlerts,
  parseGeofences,
  parseSnapshot,
  parseTrips,
  parseVehicleEventsResponse,
  parseVehicleResponse,
  systemHealthSchema,
  importResultSchema,
  toGeofenceKind,
} from "./schemas";
import { systemHealthFixture, auditResponseFixture, importResultFixture } from "../mocks/fixtures/untyped";
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
    expect(
      liveMessageSchema.safeParse({ ...openApiAlertFrame, severity: "extreme" }).success,
    ).toBe(true);
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

  it("parses the observed audit payload", () => {
    const parsed = auditResponseSchema.safeParse(auditResponseFixture);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data[0]?.action).toBe("auth.login");
    }
  });

  it("accepts both null and an array for import errors", () => {
    expect(importResultSchema.safeParse(importResultFixture).success).toBe(true);
    expect(
      importResultSchema.safeParse({ ...importResultFixture, errors: null }).success,
    ).toBe(true);
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
    expect(result.events.map((event) => event.type)).toEqual([
      "exit",
      "route_deviation",
      "enter",
    ]);
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
        { id: "trip-1", vehicle_id: "v", plate: "P", origin: "A", destination: "B", status: "planned" },
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

import { describe, expect, it } from "vitest";
import {
  auditResponseSchema,
  liveMessageSchema,
  parseGeofences,
  parseSnapshot,
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
import { vehiclesFixture } from "../mocks/fixtures/vehicles";
import { geofencesFixture } from "../mocks/fixtures/geofences";

describe("contract schemas", () => {
  it("accepts a real position frame", () => {
    const parsed = liveMessageSchema.safeParse(positionFrame);
    expect(parsed.success).toBe(true);
  });

  it("accepts a documented alert frame with unknown keys", () => {
    const parsed = liveMessageSchema.safeParse(alertFrame);
    expect(parsed.success).toBe(true);
  });

  it("accepts both documented alert frame shapes", () => {
    expect(liveMessageSchema.safeParse(handoffAlertFrame).success).toBe(true);
    expect(liveMessageSchema.safeParse(openApiAlertFrame).success).toBe(true);
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
});

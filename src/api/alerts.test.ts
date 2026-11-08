import { describe, expect, it } from "vitest";
import {
  alertMessageSchema,
  alertRuleSchema,
  parseAlertRules,
  parseAlerts,
} from "./alerts";
import { alertsFixture } from "../mocks/fixtures/alerts";
import { alertRulesFixture } from "../mocks/fixtures/alertRules";
import { alertFrame, handoffAlertFrame, openApiAlertFrame } from "../mocks/fixtures/live";

describe("alert contract", () => {
  it("parses a full staging row", () => {
    const result = parseAlerts({ data: [alertsFixture[0]] });
    expect(result.rejected).toBe(0);
    expect(result.alerts[0]).toMatchObject({
      id: alertsFixture[0]?.id,
      vehicle_id: alertsFixture[0]?.vehicle_id,
      plate: alertsFixture[0]?.plate,
      type: "geofence_exit",
      severity: "high",
      status: "open",
      evidence: { geofence_id: "00000000-0000-0000-0000-000000000203" },
    });
  });

  it("keeps optional trip and ack fields when present", () => {
    const result = parseAlerts({ data: [alertsFixture[1], alertsFixture[3]] });
    expect(result.alerts[0]?.trip_id).toBe("d72adc9e-d315-4a84-9c61-41735c005811");
    expect(result.alerts[0]?.acked_at).toBeUndefined();
    expect(result.alerts[1]?.acked_at).toBe("2026-11-02T18:10:00Z");
  });

  it("stringifies a numeric id", () => {
    const result = parseAlerts({ data: [{ ...alertsFixture[0], id: 42 }] });
    expect(result.alerts[0]?.id).toBe("42");
  });

  it("defaults missing evidence to an empty object", () => {
    const row = { ...alertsFixture[0] };
    delete (row as { evidence?: Record<string, unknown> }).evidence;
    const result = parseAlerts({ data: [row] });
    expect(result.alerts[0]?.evidence).toEqual({});
  });

  it("keeps unknown type, severity and status strings for the neutral fallback", () => {
    const result = parseAlerts({
      data: [{ ...alertsFixture[0], type: "solar_flare", severity: "extreme", status: "pending" }],
    });
    expect(result.alerts[0]).toMatchObject({
      type: "solar_flare",
      severity: "extreme",
      status: "pending",
    });
  });

  it("drops malformed rows but keeps the valid ones", () => {
    const result = parseAlerts({
      data: [alertsFixture[0], { id: "broken", vehicle_id: "v" }, { nope: true }],
    });
    expect(result.alerts).toHaveLength(1);
    expect(result.rejected).toBe(2);
  });

  it("rejects an envelope that is not a data array and one where every row fails", () => {
    expect(() => parseAlerts({ rows: [] })).toThrow();
    expect(() => parseAlerts({ data: [{ nope: true }] })).toThrow();
  });

  it("accepts an empty list", () => {
    expect(parseAlerts({ data: [] })).toEqual({ alerts: [], rejected: 0 });
  });
});

describe("alert rule contract", () => {
  it("parses the staging rules", () => {
    const result = parseAlertRules({ data: alertRulesFixture });
    expect(result.rejected).toBe(0);
    expect(result.rules).toHaveLength(alertRulesFixture.length);
    expect(result.rules[0]).toMatchObject({ type: "geofence_exit", enabled: true, config: {} });
  });

  it("normalises a null config to an empty object and keeps an unknown type", () => {
    const rule = alertRuleSchema.parse({
      id: "rule-1",
      type: "solar_flare",
      enabled: false,
      config: null,
    });
    expect(rule).toEqual({ id: "rule-1", type: "solar_flare", enabled: false, config: {} });
  });

  it("tolerates a non-object config coming back", () => {
    expect(
      alertRuleSchema.parse({ id: "rule-1", type: "idle", enabled: true, config: "bad" }).config,
    ).toEqual({});
  });

  it("defaults a missing config to an empty object", () => {
    expect(
      alertRuleSchema.parse({ id: "rule-2", type: "idle", enabled: true }).config,
    ).toEqual({});
  });

  it("drops a rule without a boolean enabled flag", () => {
    const result = parseAlertRules({
      data: [alertRulesFixture[0], { id: "bad", type: "idle", enabled: "yes" }],
    });
    expect(result.rules).toHaveLength(1);
    expect(result.rejected).toBe(1);
  });

  it("rejects an all-invalid rule payload", () => {
    expect(() => parseAlertRules({ data: [{ id: "bad" }] })).toThrow();
  });
});

describe("alert live frame contract", () => {
  it.each([alertFrame, handoffAlertFrame, openApiAlertFrame])(
    "accepts each documented frame shape",
    (frame) => {
      expect(alertMessageSchema.safeParse(frame).success).toBe(true);
    },
  );

  it("keeps an unknown severity instead of rejecting the frame", () => {
    expect(
      alertMessageSchema.safeParse({ ...openApiAlertFrame, severity: "extreme" }).success,
    ).toBe(true);
  });

  it("requires the vehicle id", () => {
    expect(alertMessageSchema.safeParse({ type: "alert" }).success).toBe(false);
  });
});

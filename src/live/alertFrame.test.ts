import { describe, expect, it } from "vitest";
import type { AlertMessage } from "../api/schemas";
import { alertBatchSummary, normalizeAlertFrame } from "./alertFrame";

const handoffFrame: AlertMessage = {
  type: "alert",
  tenant_id: "tenant-demo",
  vehicle_id: "demo-imei-0007",
  alert: {
    tenant_id: "tenant-demo",
    vehicle_id: "demo-imei-0007",
    geofence_id: "gf-1",
    geofence_name: "Lekki Depot",
    event_type: "exit",
    event_time: "2026-11-04T08:20:00Z",
    latency_ns: 2_000,
  },
};

const openApiFrame: AlertMessage = {
  type: "alert",
  vehicle_id: "demo-imei-0002",
  severity: "high",
  occurred_at: "2026-11-04T08:21:00Z",
};

const identifiedFrame: AlertMessage = {
  type: "alert",
  vehicle_id: "demo-imei-0002",
  id: "alert-1",
  alert: {
    type: "speeding",
    occurred_at: "2026-11-04T08:22:00Z",
  },
};

describe("alert frame normalisation", () => {
  it("reads the handoff shape", () => {
    const frame = normalizeAlertFrame(handoffFrame);
    expect(frame.vehicleKey).toBe("demo-imei-0007");
    expect(frame.eventLabel).toBe("Geofence exit");
    expect(frame.occurredAt).toBe("2026-11-04T08:20:00Z");
    expect(frame.severity).toBeNull();
    expect(frame.alertId).toBeNull();
    expect(frame.key).toContain("demo-imei-0007");
    expect(frame.key).toContain("gf-1");
  });

  it("reads the OpenAPI shape and keeps the top-level severity", () => {
    const frame = normalizeAlertFrame(openApiFrame);
    expect(frame.vehicleKey).toBe("demo-imei-0002");
    expect(frame.eventLabel).toBe("Alert");
    expect(frame.occurredAt).toBe("2026-11-04T08:21:00Z");
    expect(frame.severity).toBe("high");
  });

  it("prefers a real alert id for dedupe", () => {
    expect(normalizeAlertFrame(identifiedFrame).key).toBe("id:alert-1");
  });

  it("changes the dedupe key when the event time changes", () => {
    const first = normalizeAlertFrame(handoffFrame);
    const later = normalizeAlertFrame({
      ...handoffFrame,
      alert: { ...handoffFrame.alert, event_time: "2026-11-04T08:25:00Z" },
    });
    expect(first.key).not.toBe(later.key);
  });

  it("tolerates a frame with no useful detail", () => {
    const frame = normalizeAlertFrame({ type: "alert", vehicle_id: "demo-imei-0003" });
    expect(frame.eventLabel).toBe("Alert");
    expect(frame.occurredAt).toBeNull();
    expect(frame.key.length).toBeGreaterThan(0);
  });

  it("summarises one frame specifically and many as a batch", () => {
    const one = alertBatchSummary([normalizeAlertFrame(handoffFrame)]);
    expect(one.title).toBe("Geofence exit");
    expect(one.description).toContain("demo-imei-0007");

    const many = alertBatchSummary([
      normalizeAlertFrame(handoffFrame),
      normalizeAlertFrame(openApiFrame),
      normalizeAlertFrame(identifiedFrame),
    ]);
    expect(many.title).toBe("3 new alerts");
    expect(many.description).toContain("3");
  });
});

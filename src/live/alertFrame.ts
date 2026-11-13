import type { AlertMessage } from "../api/alerts";
import type { AlertSeverity } from "../api/types";
import { alertTypeLabel, isAlertType } from "../lib/status";

export interface NormalizedAlertFrame {
  key: string;
  alertId: string | null;
  vehicleKey: string;
  eventLabel: string;
  occurredAt: string | null;
  severity: AlertSeverity | null;
}

export interface AlertBatchSummary {
  count: number;
  title: string;
  description: string;
  key: string;
  /** Critical alerts are announced assertively; everything else politely. */
  assertive: boolean;
}

export const ALERT_TOAST_WINDOW_MS = 250;
export const ALERT_ANNOUNCE_MS = 5_000;

/** Throttles live alert announcements to one per five seconds. */
export function alertWindowDelay(lastFlushAt: number | null, now: number): number {
  if (lastFlushAt === null) return ALERT_TOAST_WINDOW_MS;
  return Math.max(ALERT_TOAST_WINDOW_MS, ALERT_ANNOUNCE_MS - (now - lastFlushAt));
}

const severities = new Set<AlertSeverity>(["low", "medium", "high", "critical"]);

function toSeverity(value: string | null | undefined): AlertSeverity | null {
  return value && severities.has(value as AlertSeverity) ? (value as AlertSeverity) : null;
}

const geofenceEvents: Record<string, string> = {
  enter: "Geofence entry",
  exit: "Geofence exit",
};

function eventLabel(eventType: string | null): string {
  if (!eventType) return "Alert";
  if (isAlertType(eventType)) return alertTypeLabel(eventType);
  return geofenceEvents[eventType] ?? "Alert";
}

export function normalizeAlertFrame(message: AlertMessage): NormalizedAlertFrame {
  const inner = message.alert;
  const rawId = message.id ?? inner?.id;
  const alertId = rawId === undefined ? null : String(rawId);
  const vehicleKey = message.vehicle_id;
  const eventType = inner?.type ?? inner?.event_type ?? message.event_type ?? null;
  const occurredAt =
    inner?.occurred_at ?? message.occurred_at ?? inner?.event_time ?? message.event_time ?? null;
  const severity = toSeverity(inner?.severity ?? message.severity ?? null);
  const geofence =
    inner?.geofence_id ??
    message.geofence_id ??
    inner?.geofence_name ??
    message.geofence_name ??
    "";

  return {
    key: alertId
      ? `id:${alertId}`
      : `evt:${vehicleKey}:${geofence}:${eventType ?? ""}:${occurredAt ?? ""}`,
    alertId,
    vehicleKey,
    eventLabel: eventLabel(eventType),
    occurredAt,
    severity,
  };
}

export function alertBatchSummary(frames: readonly NormalizedAlertFrame[]): AlertBatchSummary {
  const assertive = frames.some((frame) => frame.severity === "critical");

  if (frames.length === 0) {
    return {
      count: 0,
      title: "New alerts",
      description: "",
      key: "alert-batch",
      assertive,
    };
  }

  if (frames.length === 1) {
    const frame = frames[0];
    if (!frame) {
      return {
        count: 0,
        title: "New alerts",
        description: "",
        key: "alert-batch",
        assertive,
      };
    }
    return {
      count: 1,
      title: frame.eventLabel,
      description: "Open Alerts to review it.",
      key: `alert:${frame.key}`,
      assertive,
    };
  }

  return {
    count: frames.length,
    title: `${frames.length} new alerts`,
    description: "Open Alerts to review them.",
    key: "alert-batch",
    assertive,
  };
}

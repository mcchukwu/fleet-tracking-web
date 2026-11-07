import type { VehicleEvent } from "../../../api/types";
import { alertStatusLabels, alertTypeLabel, severityLabels } from "../../../lib/status";
import { EVENT_DISPLAY_LIMIT, EVENT_WINDOW_MS } from "./constants";

/** The events endpoint has no documented limit but staging caps a page at 500. */
export const EVENTS_PAGE_CAP = 500;

export function eventWindowFrom(now: number): string {
  return new Date(now - EVENT_WINDOW_MS).toISOString();
}

export function isKnownSeverity(value: string | undefined): value is keyof typeof severityLabels {
  return value !== undefined && Object.hasOwn(severityLabels, value);
}

export function isKnownAlertStatus(
  value: string | undefined,
): value is keyof typeof alertStatusLabels {
  return value !== undefined && Object.hasOwn(alertStatusLabels, value);
}

export function eventLabel(event: VehicleEvent): string {
  if (event.kind === "geofence") {
    if (event.type === "enter") return "Geofence entry";
    if (event.type === "exit") return "Geofence exit";
    return `Geofence event: ${event.type}`;
  }
  if (event.kind === "alert") return alertTypeLabel(event.type);
  return `Unknown event: ${event.kind}`;
}

export function eventKindLabel(event: VehicleEvent): string {
  if (event.kind === "geofence") return "Geofence";
  if (event.kind === "alert") return "Alert";
  return "Other";
}

export function sortEventsNewestFirst(events: readonly VehicleEvent[]): VehicleEvent[] {
  return [...events].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function recentEvents(
  events: readonly VehicleEvent[],
  limit = EVENT_DISPLAY_LIMIT,
): VehicleEvent[] {
  return sortEventsNewestFirst(events).slice(0, limit);
}

export function eventsCapLabel(loaded: number): string | null {
  if (loaded < EVENTS_PAGE_CAP) return null;
  return `Showing the ${EVENT_DISPLAY_LIMIT} most recent of the latest ${EVENTS_PAGE_CAP}.`;
}

export function humanizeEvidenceKey(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  if (!words) return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const UNIT_BY_KEY: Record<string, string> = {
  distance_m: "m",
  speed_kph: "km/h",
  limit_kph: "km/h",
  duration_s: "s",
  duration_min: "min",
};

export function formatEvidenceValue(key: string, value: unknown): string {
  const unit = UNIT_BY_KEY[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return unit ? `${value} ${unit}` : String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null) return "—";
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return "—";
}

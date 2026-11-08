import type { VehicleEvent } from "../../../api/types";
import {
  alertStatusLabels,
  alertTypeLabel,
  isAlertSeverity,
  isAlertStatus,
  severityLabels,
} from "../../../lib/status";
import { EVENT_DISPLAY_LIMIT, EVENT_WINDOW_MS } from "./constants";

/** The events endpoint has no documented limit but staging caps a page at 500. */
export const EVENTS_PAGE_CAP = 500;

export function eventWindowFrom(now: number): string {
  return new Date(now - EVENT_WINDOW_MS).toISOString();
}

export function isKnownSeverity(value: string | undefined): value is keyof typeof severityLabels {
  return isAlertSeverity(value);
}

export function isKnownAlertStatus(
  value: string | undefined,
): value is keyof typeof alertStatusLabels {
  return isAlertStatus(value);
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

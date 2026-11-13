import type { AlertSeverity, VehicleEvent } from "../../../api/types";
import { alertTypeLabel, isAlertSeverity } from "../../../lib/status";

export interface PlaybackEvent {
  key: string;
  kind: string;
  type: string;
  label: string;
  severity: AlertSeverity | null;
  status: string | null;
  at: string;
  atMs: number;
  percent: number;
}

export function eventLabel(event: Pick<VehicleEvent, "kind" | "type" | "name">): string {
  if (event.kind === "alert") return alertTypeLabel(event.type);
  if (event.kind === "geofence") {
    const name = event.name ? ` ${event.name}` : "";
    if (event.type === "enter") return `Entered${name}`;
    if (event.type === "exit") return `Exited${name}`;
    return `Geofence: ${event.type}`;
  }
  return `Unknown event: ${event.kind}`;
}

const NEAREST_TIE_PERCENT = 0.01;

export function nearestEventIndex(events: readonly PlaybackEvent[], percent: number): number {
  if (events.length === 0) return -1;
  let closest = Number.POSITIVE_INFINITY;
  for (const event of events) {
    closest = Math.min(closest, Math.abs(event.percent - percent));
  }
  let best = -1;
  for (const [index, event] of events.entries()) {
    if (Math.abs(Math.abs(event.percent - percent) - closest) > NEAREST_TIE_PERCENT) continue;
    if (best === -1 || event.atMs < (events[best]?.atMs ?? Number.POSITIVE_INFINITY)) {
      best = index;
    }
  }
  return best;
}

export function timelineEvents(
  events: readonly VehicleEvent[],
  fromMs: number,
  toMs: number,
): PlaybackEvent[] {
  const span = Math.max(1, toMs - fromMs);
  return events
    .map((event) => ({ event, atMs: Date.parse(event.at) }))
    .filter(({ atMs }) => !Number.isNaN(atMs) && atMs >= fromMs && atMs <= toMs)
    .sort((a, b) => a.atMs - b.atMs)
    .map(({ event, atMs }, index) => ({
      key: `${event.kind}:${event.type}:${event.at}:${index}`,
      kind: event.kind,
      type: event.type,
      label: eventLabel(event),
      severity: event.kind === "alert" && isAlertSeverity(event.severity) ? event.severity : null,
      status: event.status ?? null,
      at: event.at,
      atMs,
      percent: Math.min(100, Math.max(0, ((atMs - fromMs) / span) * 100)),
    }));
}

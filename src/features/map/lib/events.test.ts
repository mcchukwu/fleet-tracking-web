import { describe, expect, it } from "vitest";
import type { VehicleEvent } from "../../../api/types";
import {
  EVENTS_PAGE_CAP,
  eventKindLabel,
  eventLabel,
  eventWindowFrom,
  eventsCapLabel,
  isKnownAlertStatus,
  isKnownSeverity,
  recentEvents,
  sortEventsNewestFirst,
} from "./events";
import { EVENT_DISPLAY_LIMIT, EVENT_WINDOW_MS } from "./constants";

const geofence: VehicleEvent = {
  kind: "geofence",
  type: "enter",
  name: "Refinery Gate",
  at: "2026-11-02T14:00:00Z",
};
const alert: VehicleEvent = {
  kind: "alert",
  type: "route_deviation",
  severity: "high",
  status: "open",
  at: "2026-11-02T15:00:00Z",
  evidence: { distance_m: 2091.58 },
};

describe("event presentation", () => {
  it("labels geofence enter and exit from kind plus type", () => {
    expect(eventLabel(geofence)).toBe("Geofence entry");
    expect(eventLabel({ ...geofence, type: "exit" })).toBe("Geofence exit");
    expect(eventLabel({ ...geofence, type: "loiter" })).toBe("Geofence event: loiter");
    expect(eventKindLabel(geofence)).toBe("Geofence");
  });

  it("uses the alert label for alert events and falls back for unknown kinds", () => {
    expect(eventLabel(alert)).toBe("Route deviation");
    expect(eventLabel({ ...alert, type: "solar_flare" })).toBe("Unknown type: solar_flare");
    expect(eventKindLabel({ ...alert, kind: "solar_flare" })).toBe("Other");
    expect(eventLabel({ ...alert, kind: "solar_flare" })).toBe("Unknown event: solar_flare");
  });

  it("keeps only known severities and statuses", () => {
    expect(isKnownSeverity("critical")).toBe(true);
    expect(isKnownSeverity("extreme")).toBe(false);
    expect(isKnownAlertStatus("acked")).toBe(true);
    expect(isKnownAlertStatus("pending")).toBe(false);
  });

  it("sorts newest first without mutating the input", () => {
    const input = [geofence, alert];
    expect(sortEventsNewestFirst(input).map((event) => event.at)).toEqual([alert.at, geofence.at]);
    expect(input[0]).toBe(geofence);
  });

  it("caps the display list at 20", () => {
    const many = Array.from({ length: 25 }, (_, index) => ({
      ...alert,
      at: new Date(Date.parse(alert.at) - index * 60_000).toISOString(),
    }));
    expect(recentEvents(many)).toHaveLength(EVENT_DISPLAY_LIMIT);
  });

  it("labels the 500-row cap honestly and stays silent below it", () => {
    expect(eventsCapLabel(EVENTS_PAGE_CAP - 1)).toBeNull();
    expect(eventsCapLabel(EVENTS_PAGE_CAP)).toBe("Showing the 20 most recent of the latest 500.");
  });

  it("builds a 24h window from the current time", () => {
    const now = Date.parse("2026-11-07T12:00:00Z");
    expect(Date.parse(eventWindowFrom(now))).toBe(now - EVENT_WINDOW_MS);
  });
});

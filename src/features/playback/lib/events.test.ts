import { describe, expect, it } from "vitest";
import {
  eventLabel,
  nearestEventIndex,
  timelineEvents,
  type PlaybackEvent,
} from "./events";
import type { VehicleEvent } from "../../../api/types";

const fromMs = Date.parse("2026-11-08T14:00:00Z");
const toMs = Date.parse("2026-11-08T16:00:00Z");

function event(overrides: Partial<VehicleEvent>): VehicleEvent {
  return {
    kind: "geofence",
    type: "enter",
    at: "2026-11-08T14:30:00Z",
    ...overrides,
  };
}

describe("eventLabel", () => {
  it("labels geofence entries and exits with the zone name", () => {
    expect(eventLabel(event({ type: "enter", name: "Lekki Depot" }))).toBe(
      "Entered Lekki Depot",
    );
    expect(eventLabel(event({ type: "exit", name: "Lekki Depot" }))).toBe(
      "Exited Lekki Depot",
    );
  });

  it("labels alert events with the shared alert type labels", () => {
    expect(eventLabel(event({ kind: "alert", type: "route_deviation" }))).toBe(
      "Route deviation",
    );
    expect(eventLabel(event({ kind: "alert", type: "geofence_exit" }))).toBe(
      "Geofence exit",
    );
  });

  it("keeps unknown kinds and types neutral", () => {
    expect(eventLabel(event({ kind: "solar_flare", type: "flare" }))).toBe(
      "Unknown event: solar_flare",
    );
    expect(eventLabel(event({ kind: "alert", type: "solar_flare" }))).toBe(
      "Unknown type: solar_flare",
    );
  });
});

function row(percent: number, atMs: number): PlaybackEvent {
  return {
    key: `k:${percent}:${atMs}`,
    kind: "alert",
    type: "speeding",
    label: "Speeding",
    severity: "critical",
    status: "open",
    at: new Date(atMs).toISOString(),
    atMs,
    percent,
  };
}

describe("nearestEventIndex", () => {
  it("picks the event closest in x", () => {
    const rows = [
      row(10, fromMs + 1),
      row(40, fromMs + 2),
      row(80, fromMs + 3),
    ];
    expect(nearestEventIndex(rows, 44)).toBe(1);
    expect(nearestEventIndex(rows, 78)).toBe(2);
  });

  it("resolves an exact tie to the earlier event regardless of array order", () => {
    const earlier = row(25, fromMs + 1);
    const later = row(75, fromMs + 2);
    expect(nearestEventIndex([later, earlier], 50)).toBe(1);
    expect(nearestEventIndex([earlier, later], 50)).toBe(0);
  });

  it("returns -1 when there are no events", () => {
    expect(nearestEventIndex([], 50)).toBe(-1);
  });
});

describe("timelineEvents", () => {
  it("sorts chronologically, clips to the range and positions markers in percent", () => {
    const rows = timelineEvents(
      [
        event({ at: "2026-11-08T15:00:00Z" }),
        event({ at: "2026-11-08T13:00:00Z" }),
        event({ at: "2026-11-08T14:30:00Z" }),
        event({ at: "2026-11-08T16:30:00Z" }),
      ],
      fromMs,
      toMs,
    );
    expect(rows.map((row) => row.at)).toEqual([
      "2026-11-08T14:30:00Z",
      "2026-11-08T15:00:00Z",
    ]);
    expect(rows[0]?.percent).toBe(25);
    expect(rows[1]?.percent).toBe(50);
  });

  it("keeps severity only for known alert severities", () => {
    const rows = timelineEvents(
      [
        event({ kind: "alert", type: "speeding", severity: "critical" }),
        event({ kind: "alert", type: "speeding", severity: "extreme" }),
        event({ kind: "geofence", type: "enter", severity: "critical" }),
      ],
      fromMs,
      toMs,
    );
    expect(rows.map((row) => row.severity)).toEqual(["critical", null, null]);
  });

  it("gives same-second events unique keys", () => {
    const rows = timelineEvents(
      [event({}), event({}), event({})],
      fromMs,
      toMs,
    );
    expect(new Set(rows.map((row) => row.key)).size).toBe(3);
  });

  it("drops rows without a parseable time", () => {
    const rows = timelineEvents(
      [event({ at: "not-a-date" }), event({})],
      fromMs,
      toMs,
    );
    expect(rows).toHaveLength(1);
  });
});

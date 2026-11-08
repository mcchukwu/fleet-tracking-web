import { describe, expect, it } from "vitest";
import { shiftEventsToRange, vehicleEventsFixture } from "./events";

const fixtureFrom = Date.parse("2026-11-02T14:00:00Z");
const fixtureTo = Date.parse("2026-11-02T21:00:00Z");

describe("shiftEventsToRange", () => {
  it("preserves the exact rows when they are already inside the range", () => {
    expect(shiftEventsToRange(vehicleEventsFixture, fixtureFrom, fixtureTo)).toEqual(
      vehicleEventsFixture,
    );
  });

  it("moves every event into a distant range in the same order", () => {
    const from = Date.parse("2026-11-08T14:00:00Z");
    const to = Date.parse("2026-11-08T16:00:00Z");
    const shifted = shiftEventsToRange(vehicleEventsFixture, from, to);
    const times = shifted.map((event) => Date.parse(event.at));
    expect(times.every((time) => time >= from && time <= to)).toBe(true);
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(shifted.map((event) => event.type)).toEqual(
      vehicleEventsFixture.map((event) => event.type),
    );
  });

  it("keeps unparseable times untouched rather than inventing one", () => {
    const shifted = shiftEventsToRange(
      [{ kind: "geofence", type: "enter", at: "not-a-date" }],
      0,
      1,
    );
    expect(shifted[0]?.at).toBe("not-a-date");
  });
});

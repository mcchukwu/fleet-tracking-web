import { describe, expect, it } from "vitest";
import { replayRange, replaySearch } from "./replay";

describe("alert replay", () => {
  it("ends two minutes after the alert and starts thirty minutes before", () => {
    expect(replayRange("2026-11-02T20:07:00Z")).toEqual({
      from: "2026-11-02T19:37:00.000Z",
      to: "2026-11-02T20:09:00.000Z",
    });
  });

  it("builds the playback search with the vehicle and default resolution", () => {
    expect(replaySearch("vehicle-1", "2026-11-02T20:07:00Z")).toEqual({
      vehicle: "vehicle-1",
      from: "2026-11-02T19:37:00.000Z",
      to: "2026-11-02T20:09:00.000Z",
    });
  });

  it("returns null for an invalid timestamp", () => {
    expect(replayRange("not-a-date")).toBeNull();
    expect(replaySearch("vehicle-1", "not-a-date")).toBeNull();
  });
});

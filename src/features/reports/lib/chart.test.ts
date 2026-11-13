import { describe, expect, it } from "vitest";
import { chartDescription, chartItems, chartState } from "./chart";

describe("chartItems", () => {
  it("drops zero and negative counts", () => {
    expect(
      chartItems([
        { key: "speeding", count: 0 },
        { key: "idle", count: -2 },
        { key: "geofence_exit", count: 3 },
      ]).map((item) => item.key),
    ).toEqual(["geofence_exit"]);
  });

  it("sorts by count descending, then by label", () => {
    const items = chartItems([
      { key: "speeding", count: 4 },
      { key: "geofence_exit", count: 31 },
      { key: "idle", count: 4 },
      { key: "route_deviation", count: 7 },
    ]);
    expect(items.map((item) => item.key)).toEqual([
      "geofence_exit",
      "route_deviation",
      "idle",
      "speeding",
    ]);
    expect(items[2]?.label).toBe("Idle");
  });

  it("labels an unknown key with the neutral fallback", () => {
    expect(chartItems([{ key: "solar_flare", count: 2 }])[0]).toEqual({
      key: "solar_flare",
      label: "Unknown type: solar_flare",
      count: 2,
    });
  });

  it("uses human labels for known types", () => {
    expect(chartItems([{ key: "geofence_enter", count: 2 }])[0]?.label).toBe("Geofence entry");
  });
});

describe("chartDescription", () => {
  it("lists every visible type and count in sorted order", () => {
    const items = chartItems([
      { key: "geofence_exit", count: 31 },
      { key: "speeding", count: 4 },
    ]);
    expect(chartDescription(items)).toBe("Alerts by type: Geofence exit 31, Speeding 4.");
  });

  it("describes an empty breakdown", () => {
    expect(chartDescription([])).toBe("No alerts in this range.");
  });
});

describe("chartState", () => {
  it("is empty only when the range has no alerts", () => {
    expect(chartState(0, [])).toBe("empty");
  });

  it("is missing when alerts exist but no breakdown rows do", () => {
    expect(chartState(12, [])).toBe("missing");
  });

  it("is ready with usable rows", () => {
    expect(chartState(12, chartItems([{ key: "speeding", count: 12 }]))).toBe("ready");
  });
});

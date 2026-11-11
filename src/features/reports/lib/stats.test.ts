import { describe, expect, it } from "vitest";
import { MISSING } from "../../../lib/format";
import { completionHint, fleetTotalHint, statDestination } from "./stats";

describe("statDestination", () => {
  it("points each range-linked stat at a real destination", () => {
    expect(statDestination("vehicles")).toEqual({ to: "/map" });
    expect(statDestination("trips")).toEqual({ to: "/trips" });
    expect(statDestination("completedTrips")).toEqual({
      to: "/trips",
      search: { status: "completed" },
    });
    expect(statDestination("activeTrips")).toEqual({
      to: "/trips",
      search: { status: "active" },
    });
    expect(statDestination("alerts")).toEqual({ to: "/alerts" });
    expect(statDestination("openAlerts")).toEqual({
      to: "/alerts",
      search: { status: "open" },
    });
  });

  it("leaves distance without a destination", () => {
    expect(statDestination("distance")).toBeNull();
  });
});

describe("completionHint", () => {
  it("shows the share of trips completed", () => {
    expect(completionHint(8, 1)).toBe("13% of trips");
    expect(completionHint(8, 8)).toBe("100% of trips");
    expect(completionHint(3, 0)).toBe("0% of trips");
  });

  it("shows the missing value when there are no trips", () => {
    expect(completionHint(0, 0)).toBe(MISSING);
  });
});

describe("fleetTotalHint", () => {
  it("says the vehicle count is the whole fleet", () => {
    expect(fleetTotalHint()).toBe("Fleet total");
  });
});

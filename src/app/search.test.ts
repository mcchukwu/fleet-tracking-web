import { describe, expect, it } from "vitest";
import {
  alertsSearchSchema,
  auditSearchSchema,
  driversSearchSchema,
  geofencesSearchSchema,
  loginSearchSchema,
  mapSearchSchema,
  playbackSearchSchema,
  reportsSearchSchema,
  tripsSearchSchema,
} from "./search";

describe("route search schemas", () => {
  it("leaves empty map filters out of the URL", () => {
    expect(mapSearchSchema.parse({})).toEqual({});
  });

  it("keeps valid map filters", () => {
    const id = "4324a768-9b14-4223-a299-eb8da4d8d309";
    expect(
      mapSearchSchema.parse({ q: "LSD", status: "moving,idle", sort: "lastSeen", view: "1", v: id }),
    ).toEqual({
      q: "LSD",
      status: "moving,idle",
      sort: "lastSeen",
      view: 1,
      v: id,
    });
  });

  it("drops an invalid sort, view or vehicle id", () => {
    expect(
      mapSearchSchema.parse({ sort: "nonsense", view: "yes", v: "demo-imei-0001" }),
    ).toEqual({});
  });

  it("falls back when a value has the wrong type", () => {
    expect(alertsSearchSchema.parse({ status: 42 }).status).toBeUndefined();
  });

  it("keeps a valid alert status, severity, tab and selected id", () => {
    expect(
      alertsSearchSchema.parse({
        status: "open",
        severity: "high",
        type: "speeding",
        q: "LSD",
        tab: "rules",
        alert: "alert-1",
      }),
    ).toEqual({
      status: "open",
      severity: "high",
      type: "speeding",
      q: "LSD",
      tab: "rules",
      alert: "alert-1",
    });
  });

  it("drops an unknown alert enum or tab", () => {
    expect(alertsSearchSchema.parse({ status: "pending", severity: "extreme", tab: "other" })).toEqual(
      {},
    );
  });

  it("falls back to an automatic playback resolution", () => {
    expect(playbackSearchSchema.parse({}).resolution).toBeUndefined();
    expect(playbackSearchSchema.parse({ resolution: "auto" }).resolution).toBe("auto");
    expect(playbackSearchSchema.parse({ resolution: "5m" }).resolution).toBe("5m");
    expect(playbackSearchSchema.parse({ resolution: "nonsense" }).resolution).toBeUndefined();
  });

  it("keeps a UUID playback vehicle and drops any other id", () => {
    const id = "4324a768-9b14-4223-a299-eb8da4d8d309";
    expect(playbackSearchSchema.parse({ vehicle: id }).vehicle).toBe(id);
    expect(playbackSearchSchema.parse({ vehicle: "demo-imei-0001" }).vehicle).toBeUndefined();
  });

  it("keeps audit search, action and selected entry", () => {
    expect(
      auditSearchSchema.parse({
        q: "trip.create",
        action: "trip.create",
        entry: "207",
      }),
    ).toEqual({ q: "trip.create", action: "trip.create", entry: "207" });
    expect(auditSearchSchema.parse({})).toEqual({});
  });

  it("keeps a numeric audit entry id without quoting the shared URL", () => {
    expect(auditSearchSchema.parse({ entry: 206 })).toEqual({ entry: 206 });
    expect(auditSearchSchema.parse({ entry: "audit-8" })).toEqual({
      entry: "audit-8",
    });
  });

  it("drops repeated and malformed audit values", () => {
    expect(
      auditSearchSchema.parse({ q: ["LSD", "trip"], action: 42, entry: ["1", "2"] }),
    ).toEqual({});
  });

  it("recovers a malformed or repeated login redirect", () => {
    expect(loginSearchSchema.parse({ redirect: "/map" }).redirect).toBe("/map");
    expect(
      loginSearchSchema.parse({ redirect: ["/map", "/alerts"] }).redirect,
    ).toBeUndefined();
    expect(loginSearchSchema.parse({ redirect: 42 }).redirect).toBeUndefined();
  });

  it("keeps report ranges", () => {
    expect(reportsSearchSchema.parse({ from: "2026-11-01", to: "2026-11-03" })).toEqual({
      from: "2026-11-01",
      to: "2026-11-03",
    });
  });
});

describe("geofences route search", () => {
  it("keeps a search and a selected id", () => {
    expect(geofencesSearchSchema.parse({ q: "lekki", selected: "gf-1" })).toEqual({
      q: "lekki",
      selected: "gf-1",
    });
  });

  it("leaves empty params out of the URL", () => {
    expect(geofencesSearchSchema.parse({})).toEqual({});
  });

  it("drops repeated and malformed values", () => {
    expect(geofencesSearchSchema.parse({ q: ["Lekki", "Ibadan"] })).toEqual({});
    expect(geofencesSearchSchema.parse({ selected: 42 })).toEqual({});
  });
});

describe("trips route search", () => {
  it("keeps a valid status, search, order and selected trip", () => {
    expect(
      tripsSearchSchema.parse({
        status: "active",
        q: "lsd",
        order: "started",
        trip: "trip-1",
      }),
    ).toEqual({ status: "active", q: "lsd", order: "started", trip: "trip-1" });
  });

  it("drops an unknown status instead of trusting it", () => {
    expect(tripsSearchSchema.parse({ status: "diverted" })).toEqual({});
    expect(tripsSearchSchema.parse({ status: 42 })).toEqual({});
  });
});

describe("drivers route search", () => {
  it("keeps a valid status, search and selected driver", () => {
    expect(
      driversSearchSchema.parse({ status: "inactive", q: "ada", driver: "driver-1" }),
    ).toEqual({ status: "inactive", q: "ada", driver: "driver-1" });
  });

  it("drops an unknown status and repeated values", () => {
    expect(driversSearchSchema.parse({ status: "suspended" })).toEqual({});
    expect(driversSearchSchema.parse({ status: ["active", "inactive"] })).toEqual({});
    expect(driversSearchSchema.parse({ q: 42 })).toEqual({});
  });

  it("leaves empty params out of the URL", () => {
    expect(driversSearchSchema.parse({})).toEqual({});
  });
});

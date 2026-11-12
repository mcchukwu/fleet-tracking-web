import { describe, expect, it } from "vitest";
import { queryKeys } from "./keys";

describe("query keys", () => {
  it("keeps stable roots for persistence allowlisting", () => {
    expect(queryKeys.me).toEqual(["me"]);
    expect(queryKeys.liveSnapshot).toEqual(["live-snapshot"]);
    expect(queryKeys.alertRules).toEqual(["alert-rules"]);
    expect(queryKeys.systemHealth).toEqual(["system-health"]);
  });

  it("separates filter shapes", () => {
    expect(queryKeys.vehicles({ q: "lsd", status: "active" })).not.toEqual(
      queryKeys.vehicles({ q: "lsd" }),
    );
    expect(queryKeys.alerts({ status: "open" })).toEqual(["alerts", { status: "open" }]);
  });

  it("namespaces detail keys by id", () => {
    expect(queryKeys.vehicle("a")).toEqual(["vehicle", "a"]);
    expect(queryKeys.vehicle("a")).not.toEqual(queryKeys.vehicle("b"));
  });

  it("keeps every alert key under the alerts root so live invalidation reaches them", () => {
    const keys = [
      queryKeys.alerts({ status: "open" }),
      queryKeys.alertsFeed({ status: "open", type: "speeding" }),
      queryKeys.alertLookup("abc"),
    ];
    for (const key of keys) expect(key[0]).toBe("alerts");
    expect(queryKeys.alertsFeed({ status: "open" })).not.toEqual(queryKeys.alertsFeed({}));
    expect(queryKeys.alertLookup("a")).not.toEqual(queryKeys.alertLookup("b"));
  });
});

describe("audit keys", () => {
  it("keeps the feed and lookup under one audit root", () => {
    expect(queryKeys.auditFeed).toEqual(["audit", "feed"]);
    expect(queryKeys.auditLookup("a")).toEqual(["audit", "lookup", "a"]);
    expect(queryKeys.auditFeed[0]).toBe("audit");
    expect(queryKeys.auditLookup("a")).not.toEqual(queryKeys.auditLookup("b"));
  });
});

describe("trip feed key", () => {
  it("stays under the trips root so one invalidation reaches the feed and detail lookups", () => {
    const feed = queryKeys.tripsFeed({ status: "active" });
    expect(feed).toEqual(["trips", "feed", { status: "active" }]);
    expect(feed[0]).toBe("trips");
    expect(queryKeys.tripsFeed({ status: "active" })).not.toEqual(queryKeys.tripsFeed({}));
  });
});

import { describe, expect, it } from "vitest";
import type { AuditEntry } from "../../../api/types";
import { MISSING } from "../../../lib/format";
import {
  auditActionLabel,
  auditActionOptions,
  auditEntityLabel,
  emptyAuditReason,
  filterAuditEntries,
  findAuditEntry,
  flattenAuditPages,
  metadataSummary,
  normalizeAuditQuery,
  sortAuditEntries,
} from "./audit";

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 207,
    action: "auth.login",
    entity: "user",
    entity_id: "00000000-0000-0000-0000-000000000101",
    user_name: "Demo Admin",
    metadata: {},
    created_at: "2026-11-12T02:03:55Z",
    ...overrides,
  };
}

describe("audit labels", () => {
  it("labels every observed action", () => {
    expect(auditActionLabel("auth.login")).toBe("Login");
    expect(auditActionLabel("alert.ack")).toBe("Acknowledge alert");
    expect(auditActionLabel("driver.create")).toBe("Create driver");
    expect(auditActionLabel("driver.update")).toBe("Update driver");
    expect(auditActionLabel("geofence.create")).toBe("Create geofence");
    expect(auditActionLabel("geofence.update")).toBe("Update geofence");
    expect(auditActionLabel("geofence.delete")).toBe("Delete geofence");
    expect(auditActionLabel("import.vehicles")).toBe("Import vehicles");
    expect(auditActionLabel("trip.create")).toBe("Create trip");
    expect(auditActionLabel("trip.update")).toBe("Update trip");
    expect(auditActionLabel("trip.complete")).toBe("Complete trip");
    expect(auditActionLabel("vehicle.update")).toBe("Update vehicle");
  });

  it("humanises an unknown dotted or underscored action", () => {
    expect(auditActionLabel("user.role_change")).toBe("User role change");
    expect(auditActionLabel("user_role_change")).toBe("User role change");
    expect(auditActionLabel("")).toBe(MISSING);
  });

  it("labels every observed entity and humanises an unknown one", () => {
    expect(auditEntityLabel("user")).toBe("User");
    expect(auditEntityLabel("alert")).toBe("Alert");
    expect(auditEntityLabel("driver")).toBe("Driver");
    expect(auditEntityLabel("geofence")).toBe("Geofence");
    expect(auditEntityLabel("import_job")).toBe("Import job");
    expect(auditEntityLabel("trip")).toBe("Trip");
    expect(auditEntityLabel("vehicle")).toBe("Vehicle");
    expect(auditEntityLabel("maintenance_job")).toBe("Maintenance job");
    expect(auditEntityLabel("")).toBe(MISSING);
  });

  it("builds sorted, de-duplicated options and keeps the current unknown action", () => {
    const options = auditActionOptions(
      [
        entry({ action: "vehicle.update" }),
        entry({ action: "auth.login" }),
        entry({ action: "vehicle.update" }),
      ],
      "user.role_change",
    );

    expect(options).toEqual([
      { value: "auth.login", label: "Login" },
      { value: "vehicle.update", label: "Update vehicle" },
      { value: "user.role_change", label: "User role change" },
    ]);
  });
});

describe("audit filtering", () => {
  const rows = [
    entry({
      id: 207,
      action: "user.role_change",
      entity: "maintenance_job",
      entity_id: "00000000-0000-0000-0000-000000000901",
      user_name: "Demo Admin",
      metadata: { reason: "promotion", nested: { to: "admin" } },
    }),
    entry({
      id: 196,
      action: "trip.complete",
      entity: "trip",
      entity_id: "00000000-0000-0000-0000-000000000501",
      user_name: "Demo Dispatcher",
      metadata: { status: "completed" },
    }),
  ];

  it("trims and lowercases a query", () => {
    expect(normalizeAuditQuery("  Demo Admin  ")).toBe("demo admin");
    expect(normalizeAuditQuery("")).toBe("");
  });

  it("matches the actor, raw and labelled action, entity, ids and metadata", () => {
    const ids = (q: string) =>
      filterAuditEntries(rows, { action: null, q }).map((row) => row.id);

    expect(ids("demo dispatcher")).toEqual([196]);
    expect(ids("complete trip")).toEqual([196]);
    expect(ids("trip.complete")).toEqual([196]);
    expect(ids("maintenance job")).toEqual([207]);
    expect(ids("maintenance_job")).toEqual([207]);
    expect(ids("000000000901")).toEqual([207]);
    expect(ids("196")).toEqual([196]);
    expect(ids("promotion")).toEqual([207]);
    expect(ids("admin")).toEqual([207]);
  });

  it("applies an exact action filter and treats a blank query as no filter", () => {
    expect(
      filterAuditEntries(rows, { action: "trip.complete", q: "" }).map((row) => row.id),
    ).toEqual([196]);
    expect(filterAuditEntries(rows, { action: null, q: "   " })).toHaveLength(2);
    expect(filterAuditEntries(rows, { action: null, q: "nothing" })).toEqual([]);
  });
});

describe("audit ordering and pages", () => {
  it("sorts newest first with id descending as the tie-break", () => {
    const sorted = sortAuditEntries([
      entry({ id: 1, created_at: "2026-11-12T00:00:00Z" }),
      entry({ id: 3, created_at: "2026-11-12T01:00:00Z" }),
      entry({ id: 2, created_at: "2026-11-12T01:00:00Z" }),
    ]);

    expect(sorted.map((row) => row.id)).toEqual([3, 2, 1]);
  });

  it("keeps an invalid created_at last", () => {
    const sorted = sortAuditEntries([
      entry({ id: 1, created_at: "not a date" }),
      entry({ id: 2, created_at: "2026-11-12T01:00:00Z" }),
    ]);

    expect(sorted.map((row) => row.id)).toEqual([2, 1]);
  });

  it("deduplicates overlapping pages by id and preserves the first copy", () => {
    const first = entry({ id: 9, action: "auth.login" });
    const overlap = entry({ id: 9, action: "vehicle.update" });
    const second = entry({ id: 8, created_at: "2026-11-12T01:00:00Z" });

    const flat = flattenAuditPages([[first, second], [overlap]]);

    expect(flat.map((row) => row.id)).toEqual([9, 8]);
    expect(flat[0]?.action).toBe("auth.login");
  });
});

describe("audit metadata summary", () => {
  it("shows a missing value for an empty object", () => {
    expect(metadataSummary({})).toBe(MISSING);
  });

  it("summarises import counts", () => {
    expect(metadataSummary({ imported: 2, failed: 0 })).toBe("2 imported · 0 failed");
  });

  it("humanises keys and normalises an empty string", () => {
    expect(metadataSummary({ status: "active" })).toBe("Status: active");
    expect(metadataSummary({ status: "" })).toBe("Status: —");
    expect(metadataSummary({ vehicle_id: "trip-1" })).toBe("Vehicle: trip-1");
    expect(metadataSummary({ depot: "Apapa Depot" })).toBe("Depot: Apapa Depot");
  });

  it("renders booleans, numbers, nested values and long text as text", () => {
    expect(metadataSummary({ active: false })).toBe("Active: No");
    expect(metadataSummary({ count: 3 })).toBe("Count: 3");
    expect(metadataSummary({ nested: { reason: "promotion" } })).toBe(
      'Nested: {"reason":"promotion"}',
    );
    const long = "x".repeat(80);
    expect(metadataSummary({ note: long })).toBe(`Note: ${long}`);
  });
});

describe("audit empty reason", () => {
  const base = {
    loadedCount: 100,
    visibleCount: 0,
    hasMore: false,
    filtered: true,
    online: true,
  };

  it("names each empty state", () => {
    expect(emptyAuditReason({ ...base, loadedCount: 0, online: false })).toBe("offline");
    expect(emptyAuditReason({ ...base, loadedCount: 0, visibleCount: 0 })).toBe("no-data");
    expect(emptyAuditReason({ ...base, hasMore: true })).toBe("no-loaded-matches");
    expect(emptyAuditReason(base)).toBe("no-results");
    expect(emptyAuditReason({ ...base, visibleCount: 1 })).toBeNull();
  });
});

describe("findAuditEntry", () => {
  const rows = [entry({ id: 7 }), entry({ id: "audit-8" })];

  it("matches a numeric or string id", () => {
    expect(findAuditEntry(rows, "7")?.id).toBe(7);
    expect(findAuditEntry(rows, "audit-8")?.id).toBe("audit-8");
    expect(findAuditEntry(rows, "missing")).toBeNull();
    expect(findAuditEntry(rows, null)).toBeNull();
  });
});

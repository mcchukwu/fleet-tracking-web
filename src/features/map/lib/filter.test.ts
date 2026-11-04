import { describe, expect, it } from "vitest";
import {
  filterRows,
  filterSignature,
  matchesQuery,
  nextSelectionKey,
  normalizePlate,
  parseStatuses,
  serializeStatuses,
  sortRows,
  type MapFilterValues,
  type VehicleRow,
} from "./filter";

function row(overrides: Partial<VehicleRow> = {}): VehicleRow {
  return {
    id: "uuid-1",
    key: "demo-imei-0001",
    plate: "LSD-100-AA",
    driverName: "Adebayo Okafor",
    depot: "Lekki Depot",
    online: true,
    lat: 6.5,
    lon: 3.4,
    recordedAt: "2026-11-04T09:59:30Z",
    recordedAtMs: Date.parse("2026-11-04T09:59:30Z"),
    speedKph: 48,
    speedReportedAtMs: Date.parse("2026-11-04T09:59:30Z"),
    headingDeg: 90,
    status: "moving",
    freshness: "fresh",
    ageSeconds: 30,
    stale: false,
    ...overrides,
  };
}

const baseFilters: MapFilterValues = {
  q: "",
  statuses: [],
  depot: null,
  sort: "plate",
  onlyInView: false,
};

describe("map filters", () => {
  it("normalises plates and searches plate or external id", () => {
    expect(normalizePlate("lsd 100-aa")).toBe("LSD100AA");
    expect(matchesQuery(row(), "lsd 100")).toBe(true);
    expect(matchesQuery(row(), "demo imei 0001")).toBe(true);
    expect(matchesQuery(row(), "nope")).toBe(false);
  });

  it("parses known display statuses and drops unknown values", () => {
    expect(parseStatuses("moving,bogus,idle,moving")).toEqual(["moving", "idle"]);
    expect(parseStatuses(undefined)).toEqual([]);
    expect(serializeStatuses(["alert"])).toBe("alert");
    expect(serializeStatuses([])).toBeUndefined();
  });

  it("combines query, status and depot filters", () => {
    const rows = [
      row(),
      row({ id: "uuid-2", key: "demo-imei-0002", plate: "LSD-101-AA", status: "idle", depot: "Apapa Depot" }),
      row({ id: "uuid-3", key: "demo-imei-0003", plate: "TEST-101-AA", status: "offline", depot: "Lekki Depot" }),
    ];

    expect(filterRows(rows, { ...baseFilters, statuses: ["moving"] })).toHaveLength(1);
    expect(filterRows(rows, { ...baseFilters, depot: "Lekki Depot" })).toHaveLength(2);
    expect(filterRows(rows, { ...baseFilters, q: "101", depot: "Apapa Depot" })).toHaveLength(1);
  });

  it("keeps no-position rows out of the in-view filter", () => {
    const rows = [
      row({ lat: null, lon: null }),
      row({ id: "uuid-2", key: "demo-imei-0002", lat: 6.5, lon: 3.4 }),
    ];
    expect(filterRows(rows, { ...baseFilters, onlyInView: true }, { south: 6, west: 3, north: 7, east: 4 })).toHaveLength(1);
  });

  it("sorts by plate, last seen and status with missing values last", () => {
    const rows = [
      row({ plate: "B", status: "offline", recordedAtMs: 1 }),
      row({ plate: "A", status: "alert", recordedAtMs: null }),
      row({ plate: "C", status: "moving", recordedAtMs: 3 }),
    ];
    expect(sortRows(rows, "plate").map((item) => item.plate)).toEqual(["A", "B", "C"]);
    expect(sortRows(rows, "lastSeen").map((item) => item.plate)).toEqual(["C", "B", "A"]);
    expect(sortRows(rows, "status").map((item) => item.status)).toEqual([
      "alert",
      "moving",
      "offline",
    ]);
  });

  it("moves selection with j and k and wraps", () => {
    const rows = [row({ key: "a" }), row({ key: "b" }), row({ key: "c" })];
    expect(nextSelectionKey(rows, null, 1)).toBe("a");
    expect(nextSelectionKey(rows, null, -1)).toBe("c");
    expect(nextSelectionKey(rows, "b", 1)).toBe("c");
    expect(nextSelectionKey(rows, "c", 1)).toBe("a");
    expect(nextSelectionKey(rows, "a", -1)).toBe("c");
    expect(nextSelectionKey([], "a", 1)).toBeNull();
  });

  it("changes the signature when a visible filter changes", () => {
    expect(filterSignature(baseFilters)).toBe(filterSignature({ ...baseFilters }));
    expect(filterSignature(baseFilters)).not.toBe(
      filterSignature({ ...baseFilters, statuses: ["moving"] }),
    );
  });
});

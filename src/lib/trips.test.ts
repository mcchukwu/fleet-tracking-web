import { describe, expect, it } from "vitest";
import type { Trip } from "../api/types";
import {
  canCancelTrip,
  filterTrips,
  nextTripAction,
  reconcileCreatedTrip,
  reconcileTripTransition,
  sortTrips,
  transitionPayload,
  tripDistanceKm,
  tripEmptyReason,
  tripStatusRank,
} from "./trips";

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    vehicle_id: "vehicle-1",
    plate: "LSD-100-AA",
    origin: "Refinery Gate",
    destination: "Ibadan Customer",
    status: "planned",
    distance_km: 0,
    ...overrides,
  };
}

describe("trip transitions", () => {
  it("offers only the next valid action per status", () => {
    expect(nextTripAction(trip({ status: "planned" }))?.action).toBe("assign");
    expect(nextTripAction(trip({ status: "assigned" }))?.action).toBe("start");
    expect(nextTripAction(trip({ status: "active" }))?.action).toBe("complete");
    expect(nextTripAction(trip({ status: "completed" }))).toBeNull();
    expect(nextTripAction(trip({ status: "cancelled" }))).toBeNull();
    expect(nextTripAction(trip({ status: "diverted" }))).toBeNull();
  });

  it("marks a planned trip without a driver as needing one", () => {
    expect(nextTripAction(trip({ status: "planned" }))).toMatchObject({
      needsDriver: true,
      label: "Assign driver",
    });
    expect(
      nextTripAction(trip({ status: "planned", driver_id: "driver-1" })),
    ).toMatchObject({ needsDriver: false, label: "Assign" });
  });

  it("confirms only completion", () => {
    expect(nextTripAction(trip({ status: "active" }))?.confirm).toBe(true);
    expect(nextTripAction(trip({ status: "assigned" }))?.confirm).toBe(false);
  });

  it("allows a cancel only while the trip is not terminal", () => {
    expect(canCancelTrip(trip({ status: "planned" }))).toBe(true);
    expect(canCancelTrip(trip({ status: "active" }))).toBe(true);
    expect(canCancelTrip(trip({ status: "completed" }))).toBe(false);
    expect(canCancelTrip(trip({ status: "cancelled" }))).toBe(false);
    expect(canCancelTrip(trip({ status: "diverted" }))).toBe(false);
  });

  it("builds payloads with only the status and an optional driver", () => {
    expect(transitionPayload("assign", "driver-1")).toEqual({
      status: "assigned",
      driver_id: "driver-1",
    });
    expect(transitionPayload("assign")).toEqual({ status: "assigned" });
    expect(transitionPayload("start")).toEqual({ status: "active" });
    expect(transitionPayload("complete")).toEqual({ status: "completed" });
    expect(transitionPayload("cancel")).toEqual({ status: "cancelled" });
  });
});

describe("trip sorting", () => {
  it("orders by operational status, then newest start, then plate", () => {
    const rows = [
      trip({ id: "c", plate: "B", status: "completed" }),
      trip({ id: "p", plate: "C", status: "planned" }),
      trip({ id: "a1", plate: "Z", status: "active", started_at: "2026-11-01T10:00:00Z" }),
      trip({ id: "a2", plate: "A", status: "active", started_at: "2026-11-02T10:00:00Z" }),
      trip({ id: "a3", plate: "M", status: "active", started_at: "2026-11-02T10:00:00Z" }),
    ];

    expect(sortTrips(rows, "status").map((row) => row.id)).toEqual([
      "a2",
      "a3",
      "a1",
      "p",
      "c",
    ]);
    expect(tripStatusRank("active")).toBeLessThan(tripStatusRank("planned"));
    expect(tripStatusRank("diverted")).toBeGreaterThan(tripStatusRank("cancelled"));
  });

  it("sorts by plate and by newest start", () => {
    const rows = [
      trip({ id: "b", plate: "LSD-102-AA", started_at: "2026-11-01T10:00:00Z" }),
      trip({ id: "a", plate: "LSD-100-AA", started_at: "2026-11-02T10:00:00Z" }),
    ];
    expect(sortTrips(rows, "plate").map((row) => row.id)).toEqual(["a", "b"]);
    expect(sortTrips(rows, "started").map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("puts trips with no start last and does not mutate the input", () => {
    const rows = [
      trip({ id: "none", plate: "A" }),
      trip({ id: "started", plate: "B", started_at: "2026-11-02T10:00:00Z" }),
    ];
    expect(sortTrips(rows, "started").map((row) => row.id)).toEqual([
      "started",
      "none",
    ]);
    expect(rows.map((row) => row.id)).toEqual(["none", "started"]);
  });
});

describe("trip search", () => {
  const rows = [
    trip({
      id: "trip-1",
      plate: "LSD-100-AA",
      driver_name: "Adebayo Okafor",
      origin: "Refinery Gate",
      destination: "Ibadan Customer",
    }),
  ];

  it("matches plate ignoring spaces and hyphens", () => {
    expect(filterTrips(rows, "lsd100aa")).toHaveLength(1);
  });

  it("matches driver, origin and destination case-insensitively", () => {
    expect(filterTrips(rows, "adebayo")).toHaveLength(1);
    expect(filterTrips(rows, "refinery")).toHaveLength(1);
    expect(filterTrips(rows, "IBADAN")).toHaveLength(1);
    expect(filterTrips(rows, "no-such-trip")).toHaveLength(0);
  });

  it("returns everything for an empty query", () => {
    expect(filterTrips(rows, "  ")).toHaveLength(1);
  });
});

describe("trip distance", () => {
  it("hides distance until the trip is completed", () => {
    expect(tripDistanceKm(trip({ status: "active", distance_km: 12 }))).toBeNull();
    expect(tripDistanceKm(trip({ status: "completed", distance_km: 2.04 }))).toBe(2.04);
    expect(tripDistanceKm(trip({ status: "completed", distance_km: 0 }))).toBe(0);
  });
});

describe("trip empty reasons", () => {
  it("distinguishes no data, no results and unsearched pages", () => {
    expect(
      tripEmptyReason({ loadedCount: 0, visibleCount: 0, hasMore: false, filtered: false }),
    ).toBe("no-data");
    expect(
      tripEmptyReason({ loadedCount: 10, visibleCount: 0, hasMore: false, filtered: true }),
    ).toBe("no-results");
    expect(
      tripEmptyReason({ loadedCount: 100, visibleCount: 0, hasMore: true, filtered: true }),
    ).toBe("no-loaded-matches");
    expect(
      tripEmptyReason({ loadedCount: 10, visibleCount: 3, hasMore: false, filtered: true }),
    ).toBeNull();
  });
});

describe("trip reconciliation", () => {
  it("confirms a create only from a new matching row", () => {
    const before = new Set(["trip-1"]);
    const rows = [
      trip({ id: "trip-1" }),
      trip({ id: "trip-2", status: "planned", origin: " Refinery Gate " }),
    ];
    expect(
      reconcileCreatedTrip(rows, { vehicle_id: "vehicle-1", origin: "Refinery Gate", destination: "Ibadan Customer" }, before),
    ).toBe("saved");
    expect(
      reconcileCreatedTrip(rows, { vehicle_id: "vehicle-2", origin: "Refinery Gate", destination: "Ibadan Customer" }, before),
    ).toBe("not_saved");
  });

  it("requires the optional driver to match", () => {
    const rows = [trip({ id: "trip-2", driver_id: "driver-1" })];
    expect(
      reconcileCreatedTrip(
        rows,
        { vehicle_id: "vehicle-1", origin: "Refinery Gate", destination: "Ibadan Customer", driver_id: "driver-2" },
        new Set(),
      ),
    ).toBe("not_saved");
  });

  it("leaves a full list with no match unknown", () => {
    const rows = Array.from({ length: 500 }, (_, index) => trip({ id: `trip-${index}` }));
    expect(
      reconcileCreatedTrip(rows, { vehicle_id: "other", origin: "A", destination: "B" }, new Set()),
    ).toBe("unknown");
  });

  it("compares the fresh row for transitions", () => {
    expect(reconcileTripTransition(trip({ status: "active" }), { status: "active" })).toBe("saved");
    expect(reconcileTripTransition(trip({ status: "planned" }), { status: "active" })).toBe("not_saved");
    expect(
      reconcileTripTransition(trip({ status: "assigned", driver_id: "driver-1" }), {
        status: "assigned",
        driver_id: "driver-1",
      }),
    ).toBe("saved");
    expect(reconcileTripTransition(undefined, { status: "active" })).toBe("unknown");
  });
});

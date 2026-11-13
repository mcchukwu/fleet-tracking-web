import type { Trip, TripInput, TripStatus, TripUpdate } from "../api/types";
import { isTripStatus } from "./status";

export type TripSort = "status" | "started" | "plate";
export type TripAction = "assign" | "start" | "complete" | "cancel";
export type TripReconcileOutcome = "saved" | "not_saved" | "unknown";
export type TripEmptyReason = "no-data" | "no-results" | "no-loaded-matches";

export const tripSortOptions: readonly TripSort[] = ["status", "started", "plate"];

export function isTripSort(value: string | null | undefined): value is TripSort {
  return value === "status" || value === "started" || value === "plate";
}

export function tripSortValue(value: string | null | undefined): TripSort {
  return isTripSort(value) ? value : "status";
}

const TERMINAL: ReadonlySet<TripStatus> = new Set(["completed", "cancelled"]);

/** Actionable trips first; terminal trips sink. */
const OPERATIONAL_ORDER: readonly TripStatus[] = [
  "active",
  "assigned",
  "planned",
  "completed",
  "cancelled",
];

export interface TripNextAction {
  action: Exclude<TripAction, "cancel">;
  label: string;
  needsDriver: boolean;
  confirm: boolean;
}

export function tripStatusRank(status: string): number {
  if (!isTripStatus(status)) return OPERATIONAL_ORDER.length;
  return OPERATIONAL_ORDER.indexOf(status);
}

/** Invalid transitions are never offered; unknown statuses offer nothing. */
export function nextTripAction(trip: Pick<Trip, "status" | "driver_id">): TripNextAction | null {
  if (trip.status === "planned") {
    const needsDriver = !trip.driver_id;
    return {
      action: "assign",
      label: needsDriver ? "Assign driver" : "Assign",
      needsDriver,
      confirm: false,
    };
  }
  if (trip.status === "assigned") {
    return { action: "start", label: "Start", needsDriver: false, confirm: false };
  }
  if (trip.status === "active") {
    return { action: "complete", label: "Complete", needsDriver: false, confirm: true };
  }
  return null;
}

export function canCancelTrip(trip: Pick<Trip, "status">): boolean {
  return isTripStatus(trip.status) && !TERMINAL.has(trip.status);
}

/** Never sends distance or timestamps: the backend owns both. */
export function transitionPayload(action: TripAction, driverId?: string): TripUpdate {
  if (action === "assign") {
    return driverId ? { status: "assigned", driver_id: driverId } : { status: "assigned" };
  }
  if (action === "start") return { status: "active" };
  if (action === "complete") return { status: "completed" };
  return { status: "cancelled" };
}

export function transitionToast(action: TripAction): string {
  if (action === "assign") return "Trip assigned.";
  if (action === "start") return "Trip started.";
  if (action === "complete") return "Trip completed.";
  return "Trip cancelled.";
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]/g, "");
}

export function filterTrips(trips: readonly Trip[], query: string): Trip[] {
  const needle = normalize(query);
  if (!needle) return [...trips];
  return trips.filter((trip) =>
    [trip.plate, trip.driver_name ?? "", trip.origin, trip.destination].some((field) =>
      normalize(field).includes(needle),
    ),
  );
}

function startedAtMs(trip: Trip): number {
  if (!trip.started_at) return Number.NEGATIVE_INFINITY;
  const value = Date.parse(trip.started_at);
  return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
}

function byStartedDesc(a: Trip, b: Trip): number {
  const first = startedAtMs(a);
  const second = startedAtMs(b);
  if (!Number.isFinite(first) && !Number.isFinite(second)) return 0;
  if (!Number.isFinite(first)) return 1;
  if (!Number.isFinite(second)) return -1;
  return second - first;
}

export function sortTrips(trips: readonly Trip[], sort: TripSort): Trip[] {
  return [...trips].sort((a, b) => {
    if (sort === "status") {
      const rank = tripStatusRank(a.status) - tripStatusRank(b.status);
      if (rank !== 0) return rank;
    }
    if (sort === "status" || sort === "started") {
      const started = byStartedDesc(a, b);
      if (started !== 0) return started;
    }
    const plate = a.plate.localeCompare(b.plate);
    if (plate !== 0) return plate;
    return byStartedDesc(a, b);
  });
}

/** `distance_km` is 0 before completion, so it is unknown until the trip is completed. */
export function tripDistanceKm(trip: Pick<Trip, "status" | "distance_km">): number | null {
  return trip.status === "completed" ? trip.distance_km : null;
}

export interface TripEmptyInput {
  loadedCount: number;
  visibleCount: number;
  hasMore: boolean;
  filtered: boolean;
}

export function tripEmptyReason(input: TripEmptyInput): TripEmptyReason | null {
  if (input.visibleCount > 0) return null;
  if (input.filtered) return input.hasMore ? "no-loaded-matches" : "no-results";
  return input.loadedCount === 0 ? "no-data" : null;
}

/**
 * There is no created timestamp, so a create is confirmed by a row with the
 * exact vehicle, trimmed route and optional driver that was not in the
 * pre-submit id set. A full list with no match leaves the outcome unknown.
 */
export function reconcileCreatedTrip(
  trips: readonly Trip[],
  input: TripInput,
  beforeSubmitIds: ReadonlySet<string>,
): TripReconcileOutcome {
  const match = trips.find(
    (trip) =>
      !beforeSubmitIds.has(trip.id) &&
      trip.vehicle_id === input.vehicle_id &&
      trip.origin.trim() === input.origin.trim() &&
      trip.destination.trim() === input.destination.trim() &&
      (input.driver_id === undefined || (trip.driver_id ?? "") === input.driver_id),
  );
  if (match) return "saved";
  return trips.length >= 500 ? "unknown" : "not_saved";
}

export function reconcileTripTransition(
  trip: Trip | undefined,
  update: TripUpdate,
): TripReconcileOutcome {
  if (!trip) return "unknown";
  if (update.status !== undefined && trip.status !== update.status) return "not_saved";
  if (update.driver_id !== undefined && (trip.driver_id ?? "") !== update.driver_id) {
    return "not_saved";
  }
  return "saved";
}

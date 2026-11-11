import type { AlertStatus, TripStatus } from "../../../api/types";
import { MISSING, formatPercent } from "../../../lib/format";

export type StatId =
  | "vehicles"
  | "trips"
  | "completedTrips"
  | "activeTrips"
  | "alerts"
  | "openAlerts"
  | "distance";

export type StatDestination =
  | { to: "/map" }
  | { to: "/trips"; search?: { status?: TripStatus } }
  | { to: "/alerts"; search?: { status?: AlertStatus } };

/** Alerts and Trips have no date filter, so the links open the full lists. */
export function statDestination(id: StatId): StatDestination | null {
  switch (id) {
    case "vehicles":
      return { to: "/map" };
    case "trips":
      return { to: "/trips" };
    case "completedTrips":
      return { to: "/trips", search: { status: "completed" } };
    case "activeTrips":
      return { to: "/trips", search: { status: "active" } };
    case "alerts":
      return { to: "/alerts" };
    case "openAlerts":
      return { to: "/alerts", search: { status: "open" } };
    case "distance":
      return null;
  }
}

export function completionHint(trips: number, completedTrips: number): string {
  if (trips <= 0) return MISSING;
  return `${formatPercent(completedTrips / trips)} of trips`;
}

export function fleetTotalHint(): string {
  return "Fleet total";
}

import type {
  AlertFilters,
  AlertServerFilters,
  HistoryRange,
  TripFilters,
  TripServerFilters,
  VehicleEventRange,
  VehicleFilters,
} from "./types";

export const queryKeys = {
  me: ["me"] as const,
  vehicles: (filters: VehicleFilters = {}) => ["vehicles", filters] as const,
  vehicle: (id: string) => ["vehicle", id] as const,
  vehicleEvents: (id: string, range: VehicleEventRange = {}) =>
    ["vehicle-events", id, range] as const,
  vehicleHistory: (id: string, range: HistoryRange) => ["vehicle-history", id, range] as const,
  liveSnapshot: ["live-snapshot"] as const,
  alerts: (filters: AlertFilters = {}) => ["alerts", filters] as const,
  alertsFeed: (filters: AlertServerFilters = {}) => ["alerts", "feed", filters] as const,
  alertLookup: (id: string) => ["alerts", "lookup", id] as const,
  alertRules: ["alert-rules"] as const,
  trips: (filters: TripFilters = {}) => ["trips", filters] as const,
  tripsFeed: (filters: TripServerFilters = {}) => ["trips", "feed", filters] as const,
  drivers: ["drivers"] as const,
  geofences: ["geofences"] as const,
  reports: (from: string, to: string) => ["reports", from, to] as const,
  systemHealth: ["system-health"] as const,
  auditFeed: ["audit", "feed"] as const,
  auditLookup: (id: string) => ["audit", "lookup", id] as const,
} as const;

export const persistedQueryRoots = [
  "live-snapshot",
  "vehicles",
  "vehicle",
  "vehicle-events",
  "alerts",
  "alert-rules",
  "trips",
  "drivers",
  "geofences",
  "reports",
  "system-health",
] as const;

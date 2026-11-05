export type Role = "admin" | "dispatcher" | "security" | "viewer";
export type TripStatus = "planned" | "assigned" | "active" | "completed" | "cancelled";
export type AlertType =
  | "geofence_enter"
  | "geofence_exit"
  | "route_deviation"
  | "idle"
  | "speeding"
  | "device_offline"
  | "unplanned_trip";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "open" | "acked" | "closed";
export type GeofenceKind = "depot" | "customer" | "restricted" | "other";
export type VehicleAdministrativeStatus = "active" | "maintenance" | "inactive";
export type HistoryResolution = "raw" | "30s" | "5m";

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: Role;
}

export interface LoginResponse {
  user: User;
  csrf_token: string;
}

export interface Vehicle {
  id: string;
  external_id: string;
  plate: string;
  vehicle_type: string;
  make: string;
  model: string;
  year?: number;
  colour: string;
  status: VehicleAdministrativeStatus;
  depot: string;
  department: string;
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  trip_id?: string;
  destination?: string;
  trip_status?: TripStatus;
  lat?: number;
  lon?: number;
  speed_kph?: number;
  heading_deg?: number;
  recorded_at?: string;
  online: boolean;
  last_seen_at?: string | null;
}

export interface Point {
  t: string;
  lat: number;
  lon: number;
  speed_kph: number;
  heading_deg: number;
}

/** The subset of a snapshot row the map and its list use. Position fields are optional. */
export interface SnapshotVehicle {
  id: string;
  external_id: string;
  plate: string;
  depot: string;
  driver_name?: string;
  online: boolean;
  lat?: number;
  lon?: number;
  speed_kph?: number;
  heading_deg?: number;
  recorded_at?: string;
  trip_id?: string;
  destination?: string;
  trip_status?: TripStatus;
}

export interface Trip {
  id: string;
  vehicle_id: string;
  plate: string;
  driver_id?: string;
  driver_name?: string;
  origin: string;
  destination: string;
  status: TripStatus;
  distance_km: number;
  started_at?: string;
  ended_at?: string;
}

export interface TripInput {
  vehicle_id: string;
  driver_id?: string;
  origin: string;
  destination: string;
  status?: TripStatus;
}

export interface TripUpdate {
  status?: TripStatus;
  driver_id?: string;
}

export interface Alert {
  id: string;
  vehicle_id: string;
  plate: string;
  trip_id?: string;
  // The server may add enum values; the UI renders a neutral fallback instead of failing the list.
  type: string;
  severity: string;
  status: string;
  occurred_at: string;
  acked_at?: string;
  evidence: Record<string, unknown>;
}

export interface AlertRule {
  id: string;
  type: AlertType;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface VehicleEvent {
  kind: "geofence" | "alert";
  type: string;
  name?: string;
  severity?: AlertSeverity;
  status?: AlertStatus;
  at: string;
  evidence?: Record<string, unknown>;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licence: string;
  status: "active" | "inactive";
  vehicles: number;
}

export interface DriverInput {
  name: string;
  phone?: string;
  licence?: string;
}

export interface DriverUpdate {
  name?: string;
  phone?: string;
  licence?: string;
  status?: "active" | "inactive";
}

export interface VehicleUpdate {
  plate?: string;
  driver_id?: string;
  status?: VehicleAdministrativeStatus;
  vehicle_type?: string;
  make?: string;
  model?: string;
  year?: number;
  colour?: string;
  depot?: string;
  department?: string;
  sim_number?: string;
  device_model?: string;
  protocol?: string;
}

export interface Polygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface Geofence {
  id: string;
  name: string;
  kind: GeofenceKind;
  geometry: Polygon;
}

export interface GeofenceInput {
  name: string;
  kind?: GeofenceKind;
  geometry: Polygon;
}

export interface ReportSummary {
  from: string;
  to: string;
  vehicles: number;
  trips: number;
  completed_trips: number;
  active_trips: number;
  alerts: number;
  open_alerts: number;
  distance_km: number;
  alerts_by_type: Array<{ key: string; count: number }>;
}

export interface ImportResult {
  job_id: string;
  total: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }> | null;
}

export interface AuditEntry {
  id: number | string;
  action: string;
  entity: string;
  entity_id: string;
  user_name: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface VehicleFilters {
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface AlertFilters {
  status?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface TripFilters {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface AuditFilters {
  limit: number;
  offset: number;
}

export interface VehicleEventRange {
  from?: string;
  to?: string;
}

export interface HistoryRange {
  from?: string;
  to?: string;
  resolution?: HistoryResolution;
}

export interface ErrorResponse {
  error: { code: string; message: string; fields?: Record<string, string> };
}

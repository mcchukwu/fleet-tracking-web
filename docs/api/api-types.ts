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
  status: "active" | "maintenance" | "inactive";
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
  last_seen_at?: string;
}

export interface Point {
  t: string;
  lat: number;
  lon: number;
  speed_kph: number;
  heading_deg: number;
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
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
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
  status?: "active" | "maintenance" | "inactive";
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

export interface PositionMessage {
  type: "position";
  tenant_id: string;
  vehicle_id: string;
  lat: number;
  lon: number;
  recorded_at: string;
}

export interface AlertMessage {
  type: "alert";
  tenant_id: string;
  vehicle_id: string;
  alert: {
    tenant_id: string;
    vehicle_id: string;
    geofence_id: string;
    geofence_name: string;
    event_type: "enter" | "exit";
    event_time: string;
    latency_ns: number;
  };
}

export type LiveMessage = PositionMessage | AlertMessage;

export interface ErrorResponse {
  error: { code: string; message: string; fields?: Record<string, string> };
}

import { z } from "zod";
import { ContractError } from "../errors/types";
import {
  alertMessageSchema,
  alertSeverityField,
  alertStatusField,
  alertTimestampField,
  alertTypeField,
} from "./alerts";
import type {
  AuditEntry,
  Geofence,
  GeofenceKind,
  Point,
  ReportSummary,
  SnapshotVehicle,
  Trip,
  TripStatus,
  Vehicle,
  VehicleEvent,
} from "./types";

export {
  alertEntitySchema,
  alertMessageSchema,
  alertRuleSchema,
  alertRulesResponseSchema,
  alertsResponseSchema,
  parseAlertRules,
  parseAlerts,
} from "./alerts";
export type { AlertRulesParseResult, AlertsParseResult } from "./alerts";

export type AlertMessage = z.infer<typeof alertMessageSchema>;

const timestamp = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid timestamp");

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});

export const loginResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    tenant_id: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.enum(["admin", "dispatcher", "security", "viewer"]),
  }),
  csrf_token: z.string(),
});

export const positionMessageSchema = z.object({
  type: z.literal("position"),
  tenant_id: z.string(),
  vehicle_id: z.string(),
  lat: z.number(),
  lon: z.number(),
  recorded_at: timestamp,
});

export const liveMessageSchema = z.discriminatedUnion("type", [
  positionMessageSchema,
  alertMessageSchema,
]);

export const snapshotVehicleSchema = z.object({
  id: z.string().min(1),
  external_id: z.string().min(1),
  plate: z.string(),
  depot: z.string().optional().default(""),
  driver_id: z.string().optional(),
  driver_name: z.string().optional(),
  online: z.boolean().optional().default(false),
  lat: z.number().optional(),
  lon: z.number().optional(),
  speed_kph: z.number().optional(),
  heading_deg: z.number().optional(),
  recorded_at: timestamp.optional(),
  trip_id: z.string().optional(),
  destination: z.string().optional(),
  // Unknown values degrade to "no trip status" instead of rejecting the vehicle.
  trip_status: z.string().optional(),
});

export const liveSnapshotSchema = z.object({ data: z.array(z.unknown()) });

export const geofenceSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  kind: z.string().optional().default("other"),
  geometry: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.array(z.number()))).min(1),
  }),
});

export const geofencesSchema = z.object({ data: z.array(z.unknown()) });

export type SnapshotParseResult = { vehicles: SnapshotVehicle[]; rejected: number };
export type GeofenceParseResult = { geofences: Geofence[]; rejected: number };

const tripStatuses = new Set<TripStatus>([
  "planned",
  "assigned",
  "active",
  "completed",
  "cancelled",
]);

function toTripStatus(value: string | undefined): TripStatus | undefined {
  return value && tripStatuses.has(value as TripStatus) ? (value as TripStatus) : undefined;
}

const vehicleRowSchema = z.object({
  id: z.string().min(1),
  external_id: z.string().min(1),
  plate: z.string(),
  vehicle_type: z.string().optional().default(""),
  make: z.string().optional().default(""),
  model: z.string().optional().default(""),
  year: z.number().optional(),
  colour: z.string().optional().default(""),
  status: z.string().optional().default(""),
  depot: z.string().optional().default(""),
  department: z.string().optional().default(""),
  driver_id: z.string().optional(),
  driver_name: z.string().optional(),
  driver_phone: z.string().optional(),
  trip_id: z.string().optional(),
  destination: z.string().optional(),
  trip_status: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  speed_kph: z.number().optional(),
  heading_deg: z.number().optional(),
  recorded_at: timestamp.optional(),
  online: z.boolean().optional().default(false),
  last_seen_at: timestamp.nullable().optional(),
  sim_number: z.string().optional(),
  device_model: z.string().optional(),
  protocol: z.string().optional(),
});

/** `GET /vehicles/{id}` omits absent position, trip and device keys rather than nulling them. */
export function parseVehicleResponse(payload: unknown): Vehicle {
  const envelope = z.object({ data: z.unknown() }).safeParse(payload);
  if (!envelope.success) throw new ContractError("Vehicle envelope is not { data: {} }");

  const parsed = vehicleRowSchema.safeParse(envelope.data.data);
  if (!parsed.success) throw new ContractError("Vehicle did not match the expected shape");
  return { ...parsed.data, trip_status: toTripStatus(parsed.data.trip_status) };
}

const vehicleEventRowSchema = z.object({
  kind: z.string().min(1),
  type: alertTypeField,
  name: z.string().optional(),
  severity: alertSeverityField.optional(),
  status: alertStatusField.optional(),
  at: alertTimestampField,
  evidence: z.record(z.string(), z.unknown()).optional(),
});

export type VehicleEventsParseResult = { events: VehicleEvent[]; rejected: number };

/**
 * Events have two shapes: geofence events carry `kind: "geofence"` with
 * `type: "enter" | "exit"`, alert events carry an alert type. Branch on
 * `kind` downstream; keep unknown kinds, types and enums instead of dropping
 * the row. Newest first, because the server order is not contractual.
 */
export function parseVehicleEventsResponse(payload: unknown): VehicleEventsParseResult {
  const envelope = z.object({ data: z.array(z.unknown()) }).safeParse(payload);
  if (!envelope.success) throw new ContractError("Events envelope is not { data: [] }");

  const events: VehicleEvent[] = [];
  let rejected = 0;
  for (const row of envelope.data.data) {
    const parsed = vehicleEventRowSchema.safeParse(row);
    if (parsed.success) events.push(parsed.data);
    else rejected += 1;
  }

  if (envelope.data.data.length > 0 && events.length === 0) {
    throw new ContractError("No event row matched the expected shape");
  }

  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { events, rejected };
}

export function parseSnapshot(payload: unknown): SnapshotParseResult {
  const envelope = liveSnapshotSchema.safeParse(payload);
  if (!envelope.success) throw new ContractError("Snapshot envelope is not { data: [] }");

  const vehicles: SnapshotVehicle[] = [];
  let rejected = 0;
  for (const row of envelope.data.data) {
    const parsed = snapshotVehicleSchema.safeParse(row);
    if (parsed.success) {
      const tripStatus = toTripStatus(parsed.data.trip_status);
      vehicles.push({
        ...parsed.data,
        trip_status: tripStatus,
      });
    } else {
      rejected += 1;
    }
  }

  if (envelope.data.data.length > 0 && vehicles.length === 0) {
    throw new ContractError("No snapshot row matched the expected shape");
  }
  return { vehicles, rejected };
}

const geofenceKinds = new Set<GeofenceKind>(["depot", "customer", "restricted", "other"]);

export function toGeofenceKind(value: string | null | undefined): GeofenceKind {
  return value && geofenceKinds.has(value as GeofenceKind) ? (value as GeofenceKind) : "other";
}

export function parseGeofences(payload: unknown): GeofenceParseResult {
  const envelope = geofencesSchema.safeParse(payload);
  if (!envelope.success) throw new ContractError("Geofence envelope is not { data: [] }");

  const geofences: Geofence[] = [];
  let rejected = 0;
  for (const row of envelope.data.data) {
    const parsed = geofenceSchema.safeParse(row);
    if (parsed.success) {
      geofences.push({ ...parsed.data, kind: toGeofenceKind(parsed.data.kind) });
    } else {
      rejected += 1;
    }
  }

  if (envelope.data.data.length > 0 && geofences.length === 0) {
    throw new ContractError("No geofence row matched the expected shape");
  }
  return { geofences, rejected };
}

export const historyPointSchema = z.object({
  t: timestamp,
  lat: z.number(),
  lon: z.number(),
  speed_kph: z.number(),
  heading_deg: z.number(),
});

const tripRowSchema = z.object({
  id: z.string().min(1),
  vehicle_id: z.string().min(1),
  plate: z.string(),
  driver_id: z.string().nullable().optional(),
  driver_name: z.string().nullable().optional(),
  origin: z.string(),
  destination: z.string(),
  // An open string: unknown statuses stay renderable with a neutral fallback.
  status: z.string().min(1),
  distance_km: z.number().nullable().optional(),
  started_at: timestamp.nullable().optional(),
  ended_at: timestamp.nullable().optional(),
});

export type TripsParseResult = { trips: Trip[]; rejected: number };

/** Null driver and timestamp fields arrive as JSON null; normalise both to absent. */
export function parseTrips(payload: unknown): TripsParseResult {
  const envelope = z.object({ data: z.array(z.unknown()) }).safeParse(payload);
  if (!envelope.success) throw new ContractError("Trips envelope is not { data: [] }");

  const trips: Trip[] = [];
  let rejected = 0;
  for (const row of envelope.data.data) {
    const parsed = tripRowSchema.safeParse(row);
    if (!parsed.success) {
      rejected += 1;
      continue;
    }
    const data = parsed.data;
    trips.push({
      id: data.id,
      vehicle_id: data.vehicle_id,
      plate: data.plate,
      origin: data.origin,
      destination: data.destination,
      status: data.status,
      distance_km: data.distance_km ?? 0,
      ...(data.driver_id ? { driver_id: data.driver_id } : {}),
      ...(data.driver_name ? { driver_name: data.driver_name } : {}),
      ...(data.started_at ? { started_at: data.started_at } : {}),
      ...(data.ended_at ? { ended_at: data.ended_at } : {}),
    });
  }

  if (envelope.data.data.length > 0 && trips.length === 0) {
    throw new ContractError("No trip row matched the expected shape");
  }
  return { trips, rejected };
}

/** An empty range arrives as `data: null`; the UI treats it as no points. */
export const historyResponseSchema = z.object({
  data: z
    .array(historyPointSchema)
    .nullable()
    .transform((value) => value ?? ([] as Point[])),
  resolution: z.string(),
});

const reportSummaryRowSchema = z.object({
  vehicles: z.number().int().nonnegative(),
  trips: z.number().int().nonnegative(),
  completed_trips: z.number().int().nonnegative(),
  active_trips: z.number().int().nonnegative(),
  alerts: z.number().int().nonnegative(),
  open_alerts: z.number().int().nonnegative(),
  distance_km: z.number(),
  // Echo metadata: present in reality, absent from openapi.yaml, never required.
  from: z.string().optional(),
  to: z.string().optional(),
  alerts_by_type: z.array(z.unknown()).optional().default([]),
});

const reportChartRowSchema = z.object({
  key: z.string().min(1),
  count: z.number().min(0),
});

export type ReportSummaryParseResult = {
  summary: ReportSummary;
  rejectedChartRows: number;
};

/**
 * `alerts_by_type` rows are tolerant: one malformed row must not blank a
 * report. The seven core numbers are strict; a malformed one is a contract error.
 */
export function parseReportSummary(payload: unknown): ReportSummaryParseResult {
  const parsed = reportSummaryRowSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ContractError("Report summary did not match the expected shape");
  }

  const rows: Array<{ key: string; count: number }> = [];
  let rejectedChartRows = 0;
  for (const row of parsed.data.alerts_by_type) {
    const chartRow = reportChartRowSchema.safeParse(row);
    if (chartRow.success) rows.push(chartRow.data);
    else rejectedChartRows += 1;
  }

  return {
    summary: {
      vehicles: parsed.data.vehicles,
      trips: parsed.data.trips,
      completed_trips: parsed.data.completed_trips,
      active_trips: parsed.data.active_trips,
      alerts: parsed.data.alerts,
      open_alerts: parsed.data.open_alerts,
      distance_km: parsed.data.distance_km,
      alerts_by_type: rows,
      ...(parsed.data.from !== undefined ? { from: parsed.data.from } : {}),
      ...(parsed.data.to !== undefined ? { to: parsed.data.to } : {}),
    },
    rejectedChartRows,
  };
}

export const auditEntrySchema = z.object({
  id: z.union([z.number(), z.string()]),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string(),
  user_name: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: timestamp,
});

export const auditResponseSchema = z.object({
  data: z.array(auditEntrySchema),
});

const auditRowSchema = z.object({
  id: z.union([z.number(), z.string().min(1)]),
  action: z.string().min(1),
  entity: z.string().min(1),
  entity_id: z.string().nullish(),
  user_name: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  created_at: timestamp,
});

export type AuditParseResult = {
  entries: AuditEntry[];
  rejected: number;
  received: number;
};

/**
 * `/audit` is `type: object` in the spec, so the client contract is this
 * parser. A malformed row must not blank a security log: drop it, count it,
 * and fail only when every non-empty page is unusable.
 */
export function parseAuditResponse(payload: unknown): AuditParseResult {
  const envelope = z.object({ data: z.array(z.unknown()) }).safeParse(payload);
  if (!envelope.success) throw new ContractError("Audit envelope is not { data: [] }");

  const entries: AuditEntry[] = [];
  let rejected = 0;
  for (const row of envelope.data.data) {
    const parsed = auditRowSchema.safeParse(row);
    if (!parsed.success) {
      rejected += 1;
      continue;
    }
    const data = parsed.data;
    entries.push({
      id: data.id,
      action: data.action,
      entity: data.entity,
      entity_id: data.entity_id ?? "",
      user_name: data.user_name ?? "",
      metadata: data.metadata ?? {},
      created_at: data.created_at,
    });
  }

  const received = envelope.data.data.length;
  if (received > 0 && entries.length === 0) {
    throw new ContractError("No audit row matched the expected shape");
  }
  return { entries, rejected, received };
}

export const systemHealthSchema = z.object({
  active_trips: z.number(),
  dependencies: z.record(z.string(), z.boolean()),
  ingest: z
    .object({
      received: z.number(),
      dropped: z.number(),
      stale: z.number(),
      validation_errors: z.number(),
      queue_length: z.number(),
      queue_capacity: z.number(),
      coldpath_failed_alerts: z.number(),
      coldpath_failed_positions: z.number(),
      coldpath_queue_alerts: z.number(),
      coldpath_queue_positions: z.number(),
      redis_errors: z.number(),
    })
    .loose(),
  online: z.number(),
  open_alerts: z.number(),
  vehicles: z.number(),
});

export const importErrorSchema = z.object({
  row: z.number(),
  message: z.string(),
});

export const importResultSchema = z.object({
  job_id: z.string(),
  total: z.number(),
  imported: z.number(),
  failed: z.number(),
  errors: z.array(importErrorSchema).nullable(),
});

export type LiveMessage = z.infer<typeof liveMessageSchema>;
export type PositionMessage = z.infer<typeof positionMessageSchema>;
export type SystemHealth = z.infer<typeof systemHealthSchema>;
export type AuditResponse = z.infer<typeof auditResponseSchema>;

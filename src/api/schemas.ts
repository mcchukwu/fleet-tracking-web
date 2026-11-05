import { z } from "zod";
import { ContractError } from "../errors/types";
import type {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertType,
  Geofence,
  GeofenceKind,
  SnapshotVehicle,
  TripStatus,
} from "./types";

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

const alertFrame = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    type: z.string().optional(),
    severity: z.string().optional(),
    occurred_at: timestamp.optional(),
    geofence_id: z.string().optional(),
    geofence_name: z.string().optional(),
    event_type: z.string().optional(),
    event_time: timestamp.optional(),
    latency_ns: z.number().optional(),
  })
  .loose();

// Two documented shapes exist and no real frame has been observed. Accept both.
export const alertMessageSchema = z
  .object({
    type: z.literal("alert"),
    tenant_id: z.string().optional(),
    vehicle_id: z.string(),
    alert: alertFrame.optional(),
    id: z.union([z.string(), z.number()]).optional(),
    severity: z.string().optional(),
    occurred_at: timestamp.optional(),
    geofence_id: z.string().optional(),
    geofence_name: z.string().optional(),
    event_type: z.string().optional(),
    event_time: timestamp.optional(),
  })
  .loose();

export const liveMessageSchema = z.discriminatedUnion("type", [
  positionMessageSchema,
  alertMessageSchema,
]);

export const snapshotVehicleSchema = z.object({
  id: z.string().min(1),
  external_id: z.string().min(1),
  plate: z.string(),
  depot: z.string().optional().default(""),
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

const alertTypes: readonly AlertType[] = [
  "geofence_enter",
  "geofence_exit",
  "route_deviation",
  "idle",
  "speeding",
  "device_offline",
  "unplanned_trip",
];
const alertSeverities: readonly AlertSeverity[] = ["low", "medium", "high", "critical"];
const alertStatuses: readonly AlertStatus[] = ["open", "acked", "closed"];

function isAlertTypeValue(value: string): value is AlertType {
  return alertTypes.some((type) => type === value);
}

function isAlertSeverityValue(value: string): value is AlertSeverity {
  return alertSeverities.some((severity) => severity === value);
}

function isAlertStatusValue(value: string): value is AlertStatus {
  return alertStatuses.some((status) => status === value);
}

export const alertEntitySchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  vehicle_id: z.string().min(1),
  plate: z.string().optional().default(""),
  trip_id: z.string().optional(),
  type: z.string(),
  severity: z.string(),
  status: z.string(),
  occurred_at: timestamp,
  acked_at: timestamp.optional(),
  evidence: z.record(z.string(), z.unknown()).optional().default({}),
});

export const alertsSchema = z.object({ data: z.array(z.unknown()) });

export type AlertsParseResult = { alerts: Alert[]; rejected: number };

export function parseAlerts(payload: unknown): AlertsParseResult {
  const envelope = alertsSchema.safeParse(payload);
  if (!envelope.success) throw new ContractError("Alert envelope is not { data: [] }");

  const alerts: Alert[] = [];
  let rejected = 0;
  for (const row of envelope.data.data) {
    const parsed = alertEntitySchema.safeParse(row);
    if (
      !parsed.success ||
      !isAlertTypeValue(parsed.data.type) ||
      !isAlertSeverityValue(parsed.data.severity) ||
      !isAlertStatusValue(parsed.data.status)
    ) {
      rejected += 1;
      continue;
    }
    alerts.push({
      ...parsed.data,
      type: parsed.data.type,
      severity: parsed.data.severity,
      status: parsed.data.status,
    });
  }

  if (envelope.data.data.length > 0 && alerts.length === 0) {
    throw new ContractError("No alert row matched the expected shape");
  }
  return { alerts, rejected };
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
export type AlertMessage = z.infer<typeof alertMessageSchema>;
export type SystemHealth = z.infer<typeof systemHealthSchema>;
export type AuditResponse = z.infer<typeof auditResponseSchema>;

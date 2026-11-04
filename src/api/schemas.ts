import { z } from "zod";

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
    type: z.string().optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    occurred_at: timestamp.optional(),
    geofence_id: z.string().optional(),
    geofence_name: z.string().optional(),
    event_type: z.string().optional(),
    event_time: timestamp.optional(),
    latency_ns: z.number().optional(),
  })
  .loose();

export const alertMessageSchema = z.object({
  type: z.literal("alert"),
  tenant_id: z.string(),
  vehicle_id: z.string(),
  alert: alertFrame,
});

export const liveMessageSchema = z.discriminatedUnion("type", [
  positionMessageSchema,
  alertMessageSchema,
]);

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

import { z } from "zod";
import { ContractError } from "../errors/types";
import type { Alert, AlertRule } from "./types";

const timestamp = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid timestamp");

/**
 * The list row, the live frame's inner alert and vehicle events have different
 * envelopes but the same classification fields. Share the field schemas so the
 * three parsers cannot drift.
 */
export const alertTypeField = z.string();
export const alertSeverityField = z.string();
export const alertStatusField = z.string();
export const alertTimestampField = timestamp;

/**
 * The REST row is the alert contract. Unknown type, severity and status values
 * are kept as strings so one future enum cannot blank the list.
 */
export const alertEntitySchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  vehicle_id: z.string().min(1),
  plate: z.string().optional().default(""),
  trip_id: z.string().optional(),
  type: alertTypeField,
  severity: alertSeverityField,
  status: alertStatusField,
  occurred_at: alertTimestampField,
  acked_at: alertTimestampField.optional(),
  evidence: z.record(z.string(), z.unknown()).optional().default({}),
});

export const alertsResponseSchema = z.object({ data: z.array(z.unknown()) });

export type AlertsParseResult = { alerts: Alert[]; rejected: number };

export function parseAlerts(payload: unknown): AlertsParseResult {
  const envelope = alertsResponseSchema.safeParse(payload);
  if (!envelope.success) throw new ContractError("Alert envelope is not { data: [] }");

  const alerts: Alert[] = [];
  let rejected = 0;
  for (const row of envelope.data.data) {
    const parsed = alertEntitySchema.safeParse(row);
    if (!parsed.success) {
      rejected += 1;
      continue;
    }
    alerts.push(parsed.data);
  }

  if (envelope.data.data.length > 0 && alerts.length === 0) {
    throw new ContractError("No alert row matched the expected shape");
  }
  return { alerts, rejected };
}

/**
 * The server replaces the whole config object and validates nothing. A null or
 * absent config is the same empty object to the form.
 */
export const alertRuleSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  enabled: z.boolean(),
  config: z
    .unknown()
    .optional()
    .transform((value) =>
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {},
    ),
});

export const alertRulesResponseSchema = z.object({ data: z.array(z.unknown()) });

export type AlertRulesParseResult = { rules: AlertRule[]; rejected: number };

export function parseAlertRules(payload: unknown): AlertRulesParseResult {
  const envelope = alertRulesResponseSchema.safeParse(payload);
  if (!envelope.success) throw new ContractError("Alert rule envelope is not { data: [] }");

  const rules: AlertRule[] = [];
  let rejected = 0;
  for (const row of envelope.data.data) {
    const parsed = alertRuleSchema.safeParse(row);
    if (!parsed.success) {
      rejected += 1;
      continue;
    }
    rules.push(parsed.data);
  }

  if (envelope.data.data.length > 0 && rules.length === 0) {
    throw new ContractError("No alert rule matched the expected shape");
  }
  return { rules, rejected };
}

const alertFrame = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    type: alertTypeField.optional(),
    severity: alertSeverityField.optional(),
    occurred_at: alertTimestampField.optional(),
    geofence_id: z.string().optional(),
    geofence_name: z.string().optional(),
    event_type: z.string().optional(),
    event_time: timestamp.optional(),
    latency_ns: z.number().optional(),
  })
  .loose();

/** Two documented shapes exist and no real frame has been observed. Accept both. */
export const alertMessageSchema = z
  .object({
    type: z.literal("alert"),
    tenant_id: z.string().optional(),
    vehicle_id: z.string(),
    alert: alertFrame.optional(),
    id: z.union([z.string(), z.number()]).optional(),
    severity: alertSeverityField.optional(),
    occurred_at: alertTimestampField.optional(),
    geofence_id: z.string().optional(),
    geofence_name: z.string().optional(),
    event_type: z.string().optional(),
    event_time: timestamp.optional(),
  })
  .loose();

export type AlertMessage = z.infer<typeof alertMessageSchema>;

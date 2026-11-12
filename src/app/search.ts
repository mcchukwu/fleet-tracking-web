import { z } from "zod";

const text = z.string().optional().catch(undefined);

export const mapSearchSchema = z.object({
  q: text,
  status: text,
  depot: text,
  sort: z.enum(["plate", "lastSeen", "status"]).optional().catch(undefined),
  view: z.coerce.number().int().min(0).max(1).optional().catch(undefined),
  v: z.uuid().optional().catch(undefined),
});

export const alertsSearchSchema = z.object({
  status: z.enum(["open", "acked", "closed"]).optional().catch(undefined),
  type: text,
  severity: z.enum(["low", "medium", "high", "critical"]).optional().catch(undefined),
  q: text,
  tab: z.enum(["alerts", "rules"]).optional().catch(undefined),
  alert: text,
});

export const tripsSearchSchema = z.object({
  status: z
    .enum(["planned", "assigned", "active", "completed", "cancelled"])
    .optional()
    .catch(undefined),
  q: text,
  // `sort` already belongs to the map route; TanStack merges route search
  // types, so a second `sort` with different values fails type-checking.
  order: text,
  trip: text,
});

export const driversSearchSchema = z.object({
  status: z.enum(["active", "inactive"]).optional().catch(undefined),
  q: text,
  driver: text,
});

export const geofencesSearchSchema = z.object({
  q: text,
  selected: text,
});

export const playbackSearchSchema = z.object({
  vehicle: z.uuid().optional().catch(undefined),
  from: text,
  to: text,
  resolution: z.enum(["auto", "raw", "30s", "5m"]).optional().catch(undefined),
});

export const reportsSearchSchema = z.object({
  from: text,
  to: text,
});

export const auditSearchSchema = z.object({
  q: text,
  action: text,
  // TanStack's default search parser turns "206" into a number, so accept both
  // and keep the original type: a numeric id stays a clean `entry=206` URL.
  entry: z.union([z.string(), z.number()]).optional().catch(undefined),
});

export const loginSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});

export type MapSearch = z.infer<typeof mapSearchSchema>;
export type AlertsSearch = z.infer<typeof alertsSearchSchema>;
export type TripsSearch = z.infer<typeof tripsSearchSchema>;
export type DriversSearch = z.infer<typeof driversSearchSchema>;
export type GeofencesSearch = z.infer<typeof geofencesSearchSchema>;
export type AuditSearch = z.infer<typeof auditSearchSchema>;
export type PlaybackSearch = z.infer<typeof playbackSearchSchema>;

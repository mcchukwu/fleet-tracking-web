import { z } from "zod";

const text = z.string().optional().catch(undefined);

export const mapSearchSchema = z.object({
  q: text,
  status: text,
  depot: text,
  v: text,
});

export const alertsSearchSchema = z.object({
  status: text,
  type: text,
  severity: text,
  q: text,
});

export const tripsSearchSchema = z.object({
  status: text,
  q: text,
});

export const driversSearchSchema = z.object({
  status: text,
  q: text,
});

export const geofencesSearchSchema = z.object({
  q: text,
  selected: text,
});

export const playbackSearchSchema = z.object({
  vehicle: text,
  from: text,
  to: text,
  resolution: z.enum(["raw", "30s", "5m"]).optional().catch(undefined),
});

export const reportsSearchSchema = z.object({
  from: text,
  to: text,
});

export const auditSearchSchema = z.object({
  offset: z.coerce.number().int().min(0).optional().catch(undefined),
});

export const loginSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});

export type MapSearch = z.infer<typeof mapSearchSchema>;
export type AlertsSearch = z.infer<typeof alertsSearchSchema>;
export type PlaybackSearch = z.infer<typeof playbackSearchSchema>;

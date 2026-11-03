import { z } from "zod";

const text = z.string().catch("");

export const mapSearchSchema = z.object({
  q: text.default(""),
  status: text.default(""),
  depot: text.default(""),
  v: text.default(""),
});

export const alertsSearchSchema = z.object({
  status: text.default(""),
  type: text.default(""),
  severity: text.default(""),
  q: text.default(""),
});

export const tripsSearchSchema = z.object({
  status: text.default(""),
  q: text.default(""),
});

export const driversSearchSchema = z.object({
  status: text.default(""),
  q: text.default(""),
});

export const geofencesSearchSchema = z.object({
  q: text.default(""),
  selected: text.default(""),
});

export const playbackSearchSchema = z.object({
  vehicle: text.default(""),
  from: text.default(""),
  to: text.default(""),
  resolution: z.enum(["raw", "30s", "5m"]).catch("30s"),
});

export const reportsSearchSchema = z.object({
  from: text.default(""),
  to: text.default(""),
});

export const auditSearchSchema = z.object({
  offset: z.coerce.number().int().min(0).catch(0),
});

export const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export type MapSearch = z.infer<typeof mapSearchSchema>;
export type AlertsSearch = z.infer<typeof alertsSearchSchema>;
export type PlaybackSearch = z.infer<typeof playbackSearchSchema>;

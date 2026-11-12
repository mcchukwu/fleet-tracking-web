import type { SystemHealth } from "../../../api/schemas";
import {
  MISSING,
  formatAgeSeconds,
  formatClockTime,
  formatCount,
  formatPercent,
  formatRate,
  formatTimeTooltip,
} from "../../../lib/format";
import { getDataFreshness } from "../../../lib/status";
import { HEALTH_GROUP_SPECS, type HealthGroupId } from "./constants";

export type HealthTone = "healthy" | "warning" | "critical";

export interface HealthItem {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tooltip?: string;
  tone: HealthTone;
}

export interface HealthGroup {
  id: HealthGroupId;
  title: string;
  description: string;
  items: HealthItem[];
  columns: 2 | 4;
}

export interface HealthSample {
  data: SystemHealth;
  at: number;
}

export interface HealthTrend {
  first: HealthSample | null;
  current: HealthSample | null;
  previous: HealthSample | null;
  reset: boolean;
}

export interface HealthSummary {
  tone: HealthTone;
  issues: number;
}

const toneRank: Record<HealthTone, number> = {
  critical: 0,
  warning: 1,
  healthy: 2,
};

const toneLabels: Record<HealthTone, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
};

export function toneLabel(tone: HealthTone): string {
  return toneLabels[tone];
}

export function dependencyLabel(key: string): string {
  const words = key
    .trim()
    .split(/[_\-\s]+/)
    .filter(Boolean);
  if (words.length === 0) return "Dependency";
  return words
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word.toLowerCase(),
    )
    .join(" ");
}

export function counterDelta(
  current: number,
  first: number | null | undefined,
): number | null {
  if (first === null || first === undefined || !Number.isFinite(first)) {
    return null;
  }
  return Math.max(0, current - first);
}

export function counterRate(
  current: number,
  previous: number | null | undefined,
  elapsedMs: number | null | undefined,
): number | null {
  if (
    previous === null ||
    previous === undefined ||
    elapsedMs === null ||
    elapsedMs === undefined ||
    !Number.isFinite(previous) ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs <= 0
  ) {
    return null;
  }
  return Math.max(0, (current - previous) / (elapsedMs / 1_000));
}

export type CounterTrend = "rising" | "steady" | "falling" | "unknown";

export function counterTrend(
  current: number,
  previous: number | null | undefined,
): CounterTrend {
  if (previous === null || previous === undefined) return "unknown";
  if (current > previous) return "rising";
  if (current < previous) return "falling";
  return "steady";
}

function trendLabel(trend: CounterTrend): string {
  if (trend === "rising") return "Rising";
  if (trend === "falling") return "Falling";
  if (trend === "steady") return "Steady";
  return "Measuring…";
}

function rateLabel(rate: number | null): string {
  return rate === null ? "Measuring…" : formatRate(rate);
}

export function counterHint({
  current,
  first,
  previous,
  previousAt,
  at,
  reset,
}: {
  current: number;
  first: number | null | undefined;
  previous: number | null | undefined;
  previousAt: number | null | undefined;
  at: number | null | undefined;
  reset: boolean;
}): string {
  if (reset) return "Reset";
  const delta = counterDelta(current, first);
  const elapsed =
    previousAt !== null &&
    previousAt !== undefined &&
    at !== null &&
    at !== undefined
      ? at - previousAt
      : null;
  const rate = counterRate(current, previous, elapsed);
  if (rate === null) return "Measuring…";
  if (delta === null) return "Measuring…";
  if (delta === 0) return `No change · ${rateLabel(rate)}`;
  return `+${formatCount(delta)} · ${rateLabel(rate)}`;
}

function freshnessTone(freshness: "fresh" | "delayed" | "stale"): HealthTone {
  if (freshness === "fresh") return "healthy";
  if (freshness === "delayed") return "warning";
  return "critical";
}

function dependencyItems(data: SystemHealth): HealthItem[] {
  return Object.entries(data.dependencies).map(([key, up]) => ({
    id: `dependency-${key}`,
    label: dependencyLabel(key),
    value: up ? "Up" : "Down",
    tone: up ? "healthy" : "critical",
  }));
}

function lastReportItem(
  lastDataAt: number | null,
  now: number,
): HealthItem {
  if (lastDataAt === null) {
    return {
      id: "last-report",
      label: "Last vehicle report",
      value: MISSING,
      hint: "No vehicle reports",
      tone: "warning",
    };
  }
  const ageMs = Math.max(0, now - lastDataAt);
  return {
    id: "last-report",
    label: "Last vehicle report",
    value: formatAgeSeconds(ageMs / 1_000),
    hint: formatClockTime(lastDataAt),
    tooltip: formatTimeTooltip(new Date(lastDataAt).toISOString()),
    tone: freshnessTone(getDataFreshness(ageMs)),
  };
}

function fleetItems(
  data: SystemHealth,
  lastDataAt: number | null,
  now: number,
): HealthItem[] {
  const ratio =
    data.vehicles > 0 ? Math.min(1, data.online / data.vehicles) : null;
  return [
    {
      id: "online",
      label: "Online",
      value: `${formatCount(data.online)} of ${formatCount(data.vehicles)}`,
      ...(ratio === null
        ? {}
        : { hint: `${formatPercent(ratio)} of vehicles` }),
      tone: "healthy",
    },
    {
      id: "active-trips",
      label: "Active trips",
      value: formatCount(data.active_trips),
      tone: "healthy",
    },
    {
      id: "open-alerts",
      label: "Open alerts",
      value: formatCount(data.open_alerts),
      tone: "healthy",
    },
    lastReportItem(lastDataAt, now),
  ];
}

interface CounterSpec {
  id: string;
  label: string;
  read: (data: SystemHealth) => number;
}

const failureCounters: CounterSpec[] = [
  { id: "dropped", label: "Dropped", read: (data) => data.ingest.dropped },
  { id: "stale", label: "Stale messages", read: (data) => data.ingest.stale },
  {
    id: "validation-errors",
    label: "Validation errors",
    read: (data) => data.ingest.validation_errors,
  },
  {
    id: "coldpath-failures",
    label: "Cold-path failures",
    read: (data) =>
      data.ingest.coldpath_failed_alerts + data.ingest.coldpath_failed_positions,
  },
  {
    id: "redis-errors",
    label: "Redis errors",
    read: (data) => data.ingest.redis_errors,
  },
];

function counterItem(
  spec: CounterSpec,
  data: SystemHealth,
  trend: HealthTrend,
  at: number,
): HealthItem {
  const current = spec.read(data);
  const first = trend.first ? spec.read(trend.first.data) : null;
  const previous = trend.previous ? spec.read(trend.previous.data) : null;
  const delta = counterDelta(current, first);
  return {
    id: spec.id,
    label: spec.label,
    value: formatCount(current),
    hint: counterHint({
      current,
      first,
      previous,
      previousAt: trend.previous?.at ?? null,
      at,
      reset: trend.reset,
    }),
    tone: delta !== null && delta > 0 ? "warning" : "healthy",
  };
}

function queueItem(data: SystemHealth, trend: HealthTrend): HealthItem {
  const current = data.ingest.queue_length;
  const capacity = data.ingest.queue_capacity;
  const previous = trend.previous?.data.ingest.queue_length ?? null;
  const queueTrend = counterTrend(current, previous);
  const full = capacity > 0 ? current >= capacity : current > 0;
  return {
    id: "queue",
    label: "Queue depth",
    value: formatCount(current),
    hint:
      capacity > 0
        ? `of ${formatCount(capacity)} · ${trendLabel(queueTrend)}`
        : "Capacity not reported",
    tone: full ? "critical" : queueTrend === "rising" ? "warning" : "healthy",
  };
}

function coldpathQueueItem(data: SystemHealth, trend: HealthTrend): HealthItem {
  const read = (sample: SystemHealth) =>
    sample.ingest.coldpath_queue_alerts + sample.ingest.coldpath_queue_positions;
  const current = read(data);
  const previous = trend.previous ? read(trend.previous.data) : null;
  const queueTrend = counterTrend(current, previous);
  return {
    id: "coldpath-queue",
    label: "Cold-path queue",
    value: formatCount(current),
    hint: trendLabel(queueTrend),
    tone: queueTrend === "rising" ? "warning" : "healthy",
  };
}

function ingestItems(
  data: SystemHealth,
  trend: HealthTrend,
  at: number,
): HealthItem[] {
  const receivedFirst = trend.first?.data.ingest.received ?? null;
  return [
    {
      id: "received",
      label: "Received",
      value: formatCount(data.ingest.received),
      hint: counterHint({
        current: data.ingest.received,
        first: receivedFirst,
        previous: trend.previous?.data.ingest.received ?? null,
        previousAt: trend.previous?.at ?? null,
        at,
        reset: trend.reset,
      }),
      tone: "healthy",
    },
    ...failureCounters.map((spec) => counterItem(spec, data, trend, at)),
    queueItem(data, trend),
    coldpathQueueItem(data, trend),
  ];
}

export function sortHealthItems(items: readonly HealthItem[]): HealthItem[] {
  return [...items].sort((a, b) => toneRank[a.tone] - toneRank[b.tone]);
}

export function buildHealthGroups(
  data: SystemHealth,
  lastDataAt: number | null,
  trend: HealthTrend,
  now: number,
): HealthGroup[] {
  const itemsFor: Record<HealthGroupId, HealthItem[]> = {
    dependencies: dependencyItems(data),
    fleet: fleetItems(data, lastDataAt, now),
    ingest: ingestItems(data, trend, trend.current?.at ?? now),
  };
  return HEALTH_GROUP_SPECS.map((spec) => ({
    ...spec,
    items: sortHealthItems(itemsFor[spec.id]),
  }));
}

export function healthSummary(groups: readonly HealthGroup[]): HealthSummary {
  const items = groups.flatMap((group) => group.items);
  const issues = items.filter((item) => item.tone !== "healthy").length;
  const tone: HealthTone = items.some((item) => item.tone === "critical")
    ? "critical"
    : issues > 0
      ? "warning"
      : "healthy";
  return { tone, issues };
}

export function summaryLabel(summary: HealthSummary): string {
  if (summary.issues === 0) return "All systems healthy";
  if (summary.issues === 1) return "1 issue needs attention";
  return `${formatCount(summary.issues)} issues need attention`;
}

export function updatedLabel(at: number | null | undefined, now: number): string {
  if (at === null || at === undefined || !Number.isFinite(at) || at <= 0) {
    return "Health updated —";
  }
  const seconds = Math.max(0, Math.floor((now - at) / 1_000));
  if (seconds < 5) return "Health updated just now";
  if (seconds < 60) return `Health updated ${seconds}s ago`;
  if (seconds < 3_600) return `Health updated ${Math.floor(seconds / 60)}m ago`;
  return `Health updated ${Math.floor(seconds / 3_600)}h ago`;
}

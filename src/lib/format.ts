export const MISSING = "—";

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (!isNumber(value)) return MISSING;
  return new Intl.NumberFormat("en-GB").format(value);
}

export function formatCount(value: number | null | undefined): string {
  return formatNumber(value);
}

export function formatSpeed(kph: number | null | undefined): string {
  if (!isNumber(kph)) return MISSING;
  return `${Math.round(kph)} km/h`;
}

export function formatDistance(km: number | null | undefined): string {
  if (!isNumber(km)) return MISSING;
  const rounded = km < 100 ? km.toFixed(1) : String(Math.round(km));
  return `${rounded} km`;
}

const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function formatHeading(degrees: number | null | undefined): string {
  if (!isNumber(degrees)) return MISSING;
  const normalized = ((degrees % 360) + 360) % 360;
  const rounded = Math.round(normalized);
  const point = compass[Math.round(normalized / 45) % compass.length] ?? "N";
  return `${rounded === 360 ? 0 : rounded}° ${point}`;
}

export function formatCoordinates(
  lat: number | null | undefined,
  lon: number | null | undefined,
): string {
  if (!isNumber(lat) || !isNumber(lon)) return MISSING;
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function dateOf(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAbsoluteTime(iso: string, timeZone?: string): string {
  const date = dateOf(iso);
  if (!date) return MISSING;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function formatTimeTooltip(iso: string, timeZone?: string): string {
  const date = dateOf(iso);
  if (!date) return MISSING;
  const local = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
  const utc = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
  return `${local} · ${utc} UTC`;
}

export function formatRelativeTime(iso: string, now: number, timeZone?: string): string {
  const date = dateOf(iso);
  if (!date) return MISSING;

  const deltaSeconds = Math.round((now - date.getTime()) / 1000);
  if (deltaSeconds < 5) return "just now";
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  if (deltaSeconds < 3_600) return `${Math.floor(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86_400) return `${Math.floor(deltaSeconds / 3_600)}h ago`;
  return formatAbsoluteTime(iso, timeZone);
}

export function formatClockTime(timestamp: number | null | undefined): string {
  if (!isNumber(timestamp)) return MISSING;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export function formatAgeSeconds(seconds: number | null | undefined): string {
  if (!isNumber(seconds)) return MISSING;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3_600)}h`;
}

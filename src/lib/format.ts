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

const byteUnits = ["KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number | null | undefined): string {
  if (!isNumber(bytes) || bytes < 0) return MISSING;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < byteUnits.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${byteUnits[unit]}`;
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

export function formatPercent(fraction: number | null | undefined): string {
  if (!isNumber(fraction) || fraction < 0 || fraction > 1) return MISSING;
  return new Intl.NumberFormat("en-GB", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(fraction);
}

export function formatRangeLabel(from: string, to: string): string {
  const start = dateOf(from);
  const end = dateOf(to);
  if (!start || !end) return MISSING;
  const time = (date: Date): string =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  const day = (date: Date, withYear: boolean): string =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    }).format(date);

  const crossYear = start.getFullYear() !== end.getFullYear();
  if (!crossYear && localDay(start) === localDay(end)) {
    return `${day(start, false)}, ${time(start)} – ${time(end)}`;
  }
  return `${day(start, crossYear)}, ${time(start)} – ${day(end, crossYear)}, ${time(end)}`;
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

function playbackDate(iso: string): Date | null {
  const date = dateOf(iso);
  return date;
}

export function formatPlaybackTime(iso: string, includeDate = false): string {
  const date = playbackDate(iso);
  if (!date) return MISSING;
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  if (!includeDate) return time;
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
  return `${day} ${time}`;
}

function localDay(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export function spansLocalDays(fromMs: number, toMs: number): boolean {
  if (!isNumber(fromMs) || !isNumber(toMs)) return false;
  return localDay(new Date(fromMs)) !== localDay(new Date(toMs));
}

function minutesOnly(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatPlaybackRange(from: string, to: string): string {
  const start = playbackDate(from);
  const end = playbackDate(to);
  if (!start || !end) return MISSING;
  if (localDay(start) === localDay(end)) {
    return `${minutesOnly(start)} – ${minutesOnly(end)}`;
  }
  const startDay = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(start);
  const endDay = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(end);
  return `${startDay} ${minutesOnly(start)} – ${endDay} ${minutesOnly(end)}`;
}

export function formatPlaybackDuration(ms: number): string {
  if (!isNumber(ms) || ms < 0) return MISSING;
  const totalSeconds = Math.round(ms / 1_000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  if (days > 0) return minutes > 0 ? `${days}d ${minutes}m` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

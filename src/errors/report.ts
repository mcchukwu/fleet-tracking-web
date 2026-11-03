import type { AppError, AppErrorKind } from "./types";

const MAX_ENTRIES = 50;
const MAX_DIAGNOSTICS = 50;
const DEDUPE_WINDOW_MS = 10_000;

export interface DiagnosticEntry {
  kind: AppErrorKind;
  status?: number;
  code?: string;
  endpoint?: string;
  route: string;
  online: boolean;
  version: string;
  at: number;
  requestId?: string;
}

let entries: DiagnosticEntry[] = [];
const lastAnnounced = new Map<string, number>();

function endpointOf(resource: string | undefined): string | undefined {
  if (!resource) return undefined;
  return resource.split("?")[0];
}

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function recordError(
  error: AppError,
  options: { online?: boolean; version?: string } = {},
): void {
  const entry: DiagnosticEntry = {
    kind: error.kind,
    route: error.context.route,
    online: options.online ?? isOnline(),
    version: options.version ?? import.meta.env.VITE_APP_VERSION ?? "dev",
    at: error.at,
    ...(error.status !== undefined ? { status: error.status } : {}),
    ...(error.code ? { code: error.code } : {}),
    ...(endpointOf(error.context.resource) ? { endpoint: endpointOf(error.context.resource) } : {}),
    ...(error.requestId ? { requestId: error.requestId } : {}),
  };

  entries = [...entries.slice(-(MAX_ENTRIES - 1)), entry];

  if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
    console.warn("[fleet]", entry);
  }
}

export function diagnostics(): readonly DiagnosticEntry[] {
  return [...entries];
}

export function diagnosticsJson(): string {
  return JSON.stringify(entries, null, 2);
}

export function clearDiagnostics(): void {
  entries = [];
  lastAnnounced.clear();
}

export function shouldDedupe(kind: AppErrorKind, key: string, now = Date.now()): boolean {
  const mapKey = `${kind}:${key}`;
  const first = lastAnnounced.get(mapKey);
  if (first !== undefined && now - first < DEDUPE_WINDOW_MS) return true;
  lastAnnounced.set(mapKey, now);
  return false;
}

export { MAX_DIAGNOSTICS };

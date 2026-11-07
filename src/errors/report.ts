import type { AppError, AppErrorKind } from "./types";

const MAX_ENTRIES = 50;
const MAX_DIAGNOSTICS = 50;
const DEDUPE_WINDOW_MS = 10_000;
const LIVE_HANDSHAKE_HINT_AFTER = 3;

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
let sessionCheckSucceeded = false;
let liveHandshakeFailures = 0;
let liveHandshakeHintLogged = false;

export function diagnosticPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).pathname;
  } catch {
    return value.split(/[?#]/)[0];
  }
}

function endpointOf(resource: string | undefined): string | undefined {
  return diagnosticPath(resource);
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
  sessionCheckSucceeded = false;
  liveHandshakeFailures = 0;
  liveHandshakeHintLogged = false;
}

export function recordSessionCheckSuccess(): void {
  sessionCheckSucceeded = true;
}

export function recordLiveHandshakeSuccess(): void {
  liveHandshakeFailures = 0;
}

export function recordLiveHandshakeFailure(): void {
  liveHandshakeFailures += 1;
  if (
    liveHandshakeHintLogged ||
    liveHandshakeFailures < LIVE_HANDSHAKE_HINT_AFTER ||
    !sessionCheckSucceeded
  ) {
    return;
  }
  if (!import.meta.env.DEV || import.meta.env.MODE === "test") return;
  liveHandshakeHintLogged = true;
  console.warn(
    "[fleet] WebSocket handshake rejected. Check WS_ALLOWED_ORIGINS and the dev proxy Origin header.",
  );
}

export function shouldDedupe(kind: AppErrorKind, key: string, now = Date.now()): boolean {
  const mapKey = `${kind}:${key}`;
  const first = lastAnnounced.get(mapKey);
  if (first !== undefined && now - first < DEDUPE_WINDOW_MS) return true;
  lastAnnounced.set(mapKey, now);
  return false;
}

export { MAX_DIAGNOSTICS };

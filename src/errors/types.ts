export type AppErrorKind =
  | "offline"
  | "network"
  | "timeout"
  | "unauthenticated"
  | "csrf"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "rate_limited"
  | "server"
  | "unavailable"
  | "contract"
  | "client"
  | "chunk"
  | "storage"
  | "map"
  | "clipboard"
  | "aborted";

export interface AppError {
  kind: AppErrorKind;
  status?: number;
  code?: string;
  serverMessage?: string;
  retryable: boolean;
  outcome: "failed" | "unknown";
  retryAfterSec?: number;
  requestId?: string;
  context: { action?: string; resource?: string; route: string };
  cause?: unknown;
  at: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly serverMessage: string;
  readonly retryAfterSec?: number;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    serverMessage: string,
    retryAfterSec?: number,
    requestId?: string,
  ) {
    super(serverMessage);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.serverMessage = serverMessage;
    this.retryAfterSec = retryAfterSec;
    this.requestId = requestId;
  }
}

export class TimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class MapError extends Error {
  constructor(message = "The map could not load") {
    super(message);
    this.name = "MapError";
  }
}

export class ContractError extends Error {
  constructor(message = "Unexpected response from the server") {
    super(message);
    this.name = "ContractError";
  }
}

export class StorageError extends Error {
  constructor(message = "Offline storage is unavailable") {
    super(message);
    this.name = "StorageError";
  }
}

export class ClipboardError extends Error {
  constructor(message = "Copy was denied", options?: ErrorOptions) {
    super(message, options);
    this.name = "ClipboardError";
  }
}

const chunkMessages = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
];

export function isChunkLoadError(value: unknown): boolean {
  if (!(value instanceof Error)) return false;
  const message = value.message.toLowerCase();
  return chunkMessages.some((fragment) => message.includes(fragment));
}

export function isAppError(value: unknown): value is AppError {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AppError>;
  return (
    typeof candidate.kind === "string" &&
    typeof candidate.retryable === "boolean" &&
    typeof candidate.outcome === "string" &&
    typeof candidate.at === "number" &&
    typeof candidate.context === "object" &&
    candidate.context !== null &&
    typeof candidate.context.route === "string"
  );
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function isTimeoutError(value: unknown): value is TimeoutError {
  return value instanceof TimeoutError;
}

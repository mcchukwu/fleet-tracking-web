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

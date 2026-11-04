import { ZodError } from "zod";
import {
  ClipboardError,
  ContractError,
  MapError,
  StorageError,
  isApiError,
  isAppError,
  isChunkLoadError,
  isTimeoutError,
  type AppError,
  type AppErrorKind,
} from "./types";

export interface ErrorContext {
  action?: string;
  resource?: string;
  route?: string;
}

export interface NormalizeOptions {
  offline?: boolean;
  outcome?: "failed" | "unknown";
  now?: () => number;
}

function currentRoute(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function kindForStatus(status: number, code: string): AppErrorKind {
  if (status === 400 || status === 422) return "validation";
  if (status === 401) return "unauthenticated";
  if (status === 403) return code === "csrf_failed" ? "csrf" : "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 500) return "server";
  if (status === 502 || status === 503 || status === 504) return "unavailable";
  if (status >= 500) return "server";
  return "client";
}

function retryableKind(kind: AppErrorKind): boolean {
  return kind === "network" || kind === "timeout" || kind === "server" || kind === "unavailable";
}

function browserIsOffline(): boolean {
  return typeof navigator === "undefined" ? false : navigator.onLine === false;
}

export function normalize(
  cause: unknown,
  context: ErrorContext = {},
  options: NormalizeOptions = {},
): AppError {
  if (isAppError(cause)) return cause;

  const offline = options.offline ?? browserIsOffline();

  const base = {
    outcome: options.outcome ?? "failed",
    at: (options.now ?? Date.now)(),
    context: {
      route: context.route ?? currentRoute(),
      ...(context.action ? { action: context.action } : {}),
      ...(context.resource ? { resource: context.resource } : {}),
    },
    cause,
    retryable: false,
  } as const;

  if (
    (cause instanceof DOMException && cause.name === "AbortError") ||
    (cause instanceof Error && cause.name === "CancelledError")
  ) {
    return { ...base, kind: "aborted", retryable: false };
  }

  if (isTimeoutError(cause)) {
    return { ...base, kind: "timeout", retryable: true };
  }

  if (cause instanceof ZodError) {
    return { ...base, kind: "contract", retryable: true };
  }

  if (cause instanceof ContractError) {
    return { ...base, kind: "contract", retryable: true };
  }

  if (cause instanceof MapError) {
    return { ...base, kind: "map", retryable: true };
  }

  if (isChunkLoadError(cause)) {
    return { ...base, kind: "chunk", retryable: false };
  }

  if (cause instanceof StorageError) {
    return { ...base, kind: "storage", retryable: false };
  }

  if (cause instanceof ClipboardError) {
    return { ...base, kind: "clipboard", retryable: false };
  }

  if (isApiError(cause)) {
    const kind = kindForStatus(cause.status, cause.code);
    return {
      ...base,
      kind,
      status: cause.status,
      code: cause.code,
      serverMessage: cause.serverMessage,
      retryable: retryableKind(kind),
      ...(cause.retryAfterSec !== undefined ? { retryAfterSec: cause.retryAfterSec } : {}),
      ...(cause.requestId ? { requestId: cause.requestId } : {}),
    };
  }

  if (cause instanceof SyntaxError) {
    return { ...base, kind: "contract", retryable: true };
  }

  if (cause instanceof TypeError) {
    return { ...base, kind: offline ? "offline" : "network", retryable: !offline };
  }

  return { ...base, kind: "client", retryable: false };
}

export function isAutoRetryable(cause: unknown): boolean {
  const error = isAppError(cause) ? cause : normalize(cause);
  return error.retryable && retryableKind(error.kind);
}

export function errorKey(error: AppError): string {
  return error.code ?? error.kind;
}

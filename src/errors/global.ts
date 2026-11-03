import { QueryCache, QueryClient, MutationCache } from "@tanstack/react-query";
import { normalize, isAutoRetryable } from "./normalize";
import { isAppError } from "./types";
import { recordError } from "./report";
import { claimChunkReload } from "../lib/storage";
import type { AppError, AppErrorKind } from "./types";
import type { FleetMeta } from "../api/queryMeta";

const STORM_WINDOW_MS = 30_000;
const stormKinds = new Set<AppErrorKind>(["network", "server", "unavailable"]);

interface Failure {
  resource: string;
  at: number;
}

let failures: Failure[] = [];

export function recordRequestFailure(
  resource: string,
  kind: AppErrorKind,
  at = Date.now(),
): void {
  if (!stormKinds.has(kind)) return;
  failures = failures.filter((failure) => at - failure.at <= STORM_WINDOW_MS);
  if (!failures.some((failure) => failure.resource === resource)) {
    failures = [...failures, { resource, at }];
  }
}

export function isErrorStorm(now = Date.now()): boolean {
  return failures.filter((failure) => now - failure.at <= STORM_WINDOW_MS).length >= 3;
}

export function recordRequestSuccess(): void {
  failures = [];
}

export function resetErrorStorm(): void {
  failures = [];
}

function appEvent(name: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function handleGlobalError(cause: unknown, meta?: FleetMeta): AppError {
  const error = isAppError(cause) ? cause : normalize(cause, {
    resource: meta?.resource,
    route: typeof window === "undefined" ? "/" : window.location.pathname,
  });
  recordError(error);
  recordRequestFailure(meta?.resource ?? error.context.resource ?? "unknown", error.kind);

  if (error.kind === "unauthenticated") appEvent("fleet:session-expired");
  if (error.kind === "chunk") appEvent("fleet:update-available");

  return error;
}

export function createQueryClient(): QueryClient {
  const queryCache = new QueryCache({
    onError: (error, query) => {
      handleGlobalError(error, query.meta);
    },
    onSuccess: () => {
      recordRequestSuccess();
    },
  });

  const mutationCache = new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      handleGlobalError(error, mutation.meta ?? undefined);
    },
  });

  return new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => failureCount < 2 && isAutoRetryable(error),
        networkMode: "offlineFirst",
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
        networkMode: "offlineFirst",
      },
    },
  });
}

export function installWindowErrorHandlers(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onError = (event: ErrorEvent) => {
    handleGlobalError(event.error ?? new Error(event.message));
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    handleGlobalError(event.reason);
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

export function installPreloadErrorHandler(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onPreloadError = (event: Event) => {
    event.preventDefault();
    if (claimChunkReload()) appEvent("fleet:update-available");
  };

  window.addEventListener("vite:preloadError", onPreloadError);
  return () => window.removeEventListener("vite:preloadError", onPreloadError);
}

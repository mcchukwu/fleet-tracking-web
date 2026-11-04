import type { AppError, AppErrorKind } from "./types";

export type ErrorAction =
  | "retry"
  | "refresh"
  | "sign_in"
  | "go_back"
  | "reload"
  | "dismiss"
  | "none";

export interface ErrorCopy {
  title: string;
  detail: string;
  action: ErrorAction;
}

export interface CopyHints {
  action?: string;
  resource?: string;
}

const safeServerCodes = new Set([
  "conflict",
  "geofence_has_events",
  "invalid_credentials",
  "invalid_input",
  "invalid_request",
  "rate_limited",
  "validation_failed",
]);

export function isSafeServerCode(code: string | undefined): boolean {
  return code !== undefined && safeServerCodes.has(code);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function safeMessage(error: AppError): string | undefined {
  if (!isSafeServerCode(error.code)) return undefined;
  return error.serverMessage;
}

function defaultCopy(kind: AppErrorKind): ErrorCopy {
  switch (kind) {
    case "offline":
      return {
        title: "You're offline",
        detail: "Changes are disabled until you're back online.",
        action: "none",
      };
    case "network":
      return {
        title: "Can't reach the server",
        detail: "Check your connection. Your data is safe.",
        action: "retry",
      };
    case "timeout":
      return {
        title: "This is taking too long",
        detail: "The server didn't respond in time.",
        action: "retry",
      };
    case "unauthenticated":
      return {
        title: "Your session expired",
        detail: "Sign in to continue. You'll stay where you are.",
        action: "sign_in",
      };
    case "csrf":
      return {
        title: "Couldn't verify the request",
        detail: "Refresh the page and try again.",
        action: "refresh",
      };
    case "forbidden":
      return {
        title: "You don't have access to this",
        detail: "Your role can't do that. Ask an admin if you need it.",
        action: "go_back",
      };
    case "not_found":
      return {
        title: "Not found",
        detail: "It may have been removed.",
        action: "go_back",
      };
    case "conflict":
      return {
        title: "Couldn't complete that",
        detail: "Refresh to see the latest changes.",
        action: "refresh",
      };
    case "validation":
      return {
        title: "Check the highlighted fields",
        detail: "Some fields need attention before this can be saved.",
        action: "none",
      };
    case "rate_limited":
      return {
        title: "Too many attempts",
        detail: "Try again shortly.",
        action: "retry",
      };
    case "server":
      return {
        title: "Something went wrong on our side",
        detail: "Try again in a moment. If it keeps happening, check System.",
        action: "retry",
      };
    case "unavailable":
      return {
        title: "The service is temporarily unavailable",
        detail: "We'll keep trying.",
        action: "retry",
      };
    case "contract":
      return {
        title: "Unexpected response from the server",
        detail: "We're showing what we can.",
        action: "retry",
      };
    case "client":
      return {
        title: "This part of the page stopped working",
        detail: "Your data is safe.",
        action: "reload",
      };
    case "chunk":
      return {
        title: "A new version is available",
        detail: "Reload to continue.",
        action: "reload",
      };
    case "storage":
      return {
        title: "Offline storage isn't available",
        detail: "Offline mode is limited in this browser.",
        action: "dismiss",
      };
    case "map":
      return {
        title: "The map couldn't load",
        detail: "Vehicles are still listed on the left.",
        action: "retry",
      };
    case "clipboard":
      return {
        title: "Couldn't copy",
        detail: "Select the text and press Ctrl+C.",
        action: "none",
      };
    case "aborted":
      return {
        title: "Request cancelled",
        detail: "Nothing was changed.",
        action: "none",
      };
  }
}

export function errorCopy(error: AppError, hints: CopyHints = {}): ErrorCopy {
  const copy = defaultCopy(error.kind);

  if (error.outcome === "unknown") {
    const target = hints.resource ?? error.context.resource ?? "the list";
    return {
      ...copy,
      detail: `We couldn't confirm that it saved. Check ${target} before trying again.`,
    };
  }

  if (error.kind === "forbidden") {
    return {
      ...copy,
      detail: `Your role can't ${hints.action ?? error.context.action ?? "do that"}. Ask an admin if you need it.`,
    };
  }

  if (error.kind === "not_found") {
    const resource = hints.resource ?? error.context.resource;
    return { ...copy, title: `${capitalize(resource ?? "Item")} not found` };
  }

  if (error.kind === "conflict") {
    return {
      ...copy,
      title: `Couldn't ${hints.action ?? error.context.action ?? "complete that"}`,
      detail: safeMessage(error) ?? copy.detail,
    };
  }

  if (error.kind === "validation") {
    return { ...copy, detail: safeMessage(error) ?? copy.detail };
  }

  if (error.kind === "rate_limited") {
    return {
      ...copy,
      detail:
        error.retryAfterSec !== undefined
          ? `Try again in ${error.retryAfterSec}s.`
          : "Try again shortly.",
    };
  }

  return copy;
}

export const copyDiagnosticsKinds = new Set<AppErrorKind>(["server", "contract", "client"]);

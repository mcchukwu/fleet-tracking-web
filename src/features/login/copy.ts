import { errorCopy } from "../../errors/catalog";
import type { AppError } from "../../errors/types";

export interface LoginCopy {
  title: string;
  detail: string;
}

export interface LoginCopyHints {
  remainingSec?: number;
}

export function loginErrorCopy(error: AppError, hints: LoginCopyHints = {}): LoginCopy {
  if (error.kind === "unauthenticated") {
    return { title: "Email or password is incorrect.", detail: "" };
  }

  if (error.kind === "rate_limited") {
    const seconds = hints.remainingSec ?? error.retryAfterSec;
    if (seconds !== undefined && seconds > 0) {
      return { title: "Too many attempts", detail: `Try again in ${seconds}s.` };
    }
    if (seconds === 0) {
      return { title: "Too many attempts", detail: "You can try again now." };
    }
    return { title: "Too many attempts", detail: "Try again shortly." };
  }

  if (error.kind === "offline") {
    return { title: "You're offline", detail: "Reconnect to sign in." };
  }

  return errorCopy(error);
}

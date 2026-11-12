import type { QueryClient } from "@tanstack/react-query";
import { api } from "../api/instance";
import { meQueryOptions } from "../api/hooks/auth";
import type { User } from "../api/types";
import { isAppError, type AppError } from "../errors/types";
import { normalize } from "../errors/normalize";
import { useAuthStore } from "./store";
import { useConnectionStore } from "../stores/connection";

function offline(): boolean {
  return useConnectionStore.getState().network === "offline";
}

function classified(cause: unknown): AppError {
  return isAppError(cause) ? cause : normalize(cause);
}

/**
 * The router's only auth gate. Offline it trusts the minimal stored profile and
 * never makes a request; online it verifies an unverified profile exactly once
 * through TanStack Query, which single-flights concurrent callers.
 */
export async function ensureSession(queryClient: QueryClient): Promise<User | null> {
  const state = useAuthStore.getState();
  if (state.status === "expired") return state.user;

  if (offline()) {
    if (state.status === "authenticated" && state.user) return state.user;
    state.clear();
    return null;
  }

  if (state.status === "authenticated" && state.user) {
    if (state.sessionVerified) return state.user;
    try {
      const response = await queryClient.ensureQueryData(meQueryOptions());
      api.setCsrfToken(response.csrf_token);
      state.setSession(response.user, response.csrf_token);
      return response.user;
    } catch (cause) {
      const error = classified(cause);
      if (error.kind === "unauthenticated") {
        state.clear();
        return null;
      }
      // The profile stays usable and unverified until the next online check.
      if (error.kind === "offline" || error.kind === "network") return state.user;
      throw cause;
    }
  }

  if (state.status === "anonymous") return null;

  try {
    const response = await queryClient.ensureQueryData(meQueryOptions());
    api.setCsrfToken(response.csrf_token);
    state.setSession(response.user, response.csrf_token);
    return response.user;
  } catch (cause) {
    const error = classified(cause);
    if (error.kind === "unauthenticated") {
      state.clear();
      return null;
    }
    if ((error.kind === "offline" || error.kind === "network") && state.user) {
      return state.user;
    }
    throw cause;
  }
}

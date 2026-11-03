import type { QueryClient } from "@tanstack/react-query";
import { meQueryOptions } from "../api/hooks/auth";
import { api } from "../api/instance";
import type { User } from "../api/types";
import { isAppError } from "../errors/types";
import { useAuthStore } from "./store";

export async function ensureSession(queryClient: QueryClient): Promise<User | null> {
  const state = useAuthStore.getState();
  if (state.status === "authenticated" && state.user) return state.user;

  try {
    const response = await queryClient.ensureQueryData(meQueryOptions());
    api.setCsrfToken(response.csrf_token);
    state.setSession(response.user, response.csrf_token);
    return response.user;
  } catch (cause) {
    if (isAppError(cause) && cause.kind === "unauthenticated") {
      state.clear();
      return null;
    }
    throw cause;
  }
}

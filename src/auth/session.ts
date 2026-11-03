import { api } from "../api/instance";
import type { User } from "../api/types";
import { isAppError } from "../errors/types";
import { useAuthStore } from "./store";

let restoring: Promise<User | null> | null = null;

async function restoreSession(): Promise<User | null> {
  const state = useAuthStore.getState();
  try {
    const response = await api.me();
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

export function ensureSession(): Promise<User | null> {
  const state = useAuthStore.getState();
  if (state.status === "authenticated" && state.user) return Promise.resolve(state.user);

  if (!restoring) {
    restoring = restoreSession().finally(() => {
      restoring = null;
    });
  }
  return restoring;
}

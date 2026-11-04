import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/instance";
import { useMe } from "../api/hooks/auth";
import { useAuthStore } from "./store";
import { isAppError } from "../errors/types";

export function handleSessionExpired(): void {
  const state = useAuthStore.getState();
  if (state.status === "expired") return;
  if (state.status === "unknown" || state.status === "anonymous") {
    state.clear();
  } else {
    state.expire();
  }
}

api.setSessionHandlers({
  onSessionExpired: handleSessionExpired,
  refreshCsrf: async () => {
    const response = await api.me();
    useAuthStore.getState().setSession(response.user, response.csrf_token);
    return response.csrf_token;
  },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const status = useAuthStore((state) => state.status);
  const me = useMe({ enabled: status === "unknown" || status === "authenticated" });
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!me.data) return;
    const { user, csrf_token: csrfToken } = me.data;
    if (previousUserId.current !== null && previousUserId.current !== user.id) {
      queryClient.clear();
    }
    previousUserId.current = user.id;
    api.setCsrfToken(csrfToken);
    useAuthStore.getState().setSession(user, csrfToken);
  }, [me.data, queryClient]);

  useEffect(() => {
    if (!me.isError || !isAppError(me.error) || me.error.kind !== "unauthenticated") return;
    const state = useAuthStore.getState();
    if (state.status === "authenticated" || state.status === "expired") {
      state.expire();
    } else {
      state.clear();
    }
  }, [me.isError, me.error]);

  useEffect(() => {
    const onExpired = () => {
      const state = useAuthStore.getState();
      if (state.status !== "authenticated") return;
      state.expire();
      void queryClient.cancelQueries();
    };
    window.addEventListener("fleet:session-expired", onExpired);
    return () => window.removeEventListener("fleet:session-expired", onExpired);
  }, [queryClient]);

  return <>{children}</>;
}

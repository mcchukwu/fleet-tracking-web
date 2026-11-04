import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/instance";
import { useAuthStore } from "./store";

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
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (previousUserId.current !== null && userId !== null && previousUserId.current !== userId) {
      queryClient.clear();
    }
    if (userId !== null) previousUserId.current = userId;
  }, [userId, queryClient]);

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

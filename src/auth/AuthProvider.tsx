import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/instance";
import { normalize } from "../errors/normalize";
import { recordError } from "../errors/report";
import { clearImportHistory } from "../lib/importHistory";
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
    const previous = previousUserId.current;
    if (previous !== null && previous !== userId) {
      queryClient.clear();
      void clearImportHistory().catch((cause: unknown) => {
        recordError(
          normalize(cause, {
            action: "clear import history",
            resource: "import history",
          }),
        );
      });
    }
    if (userId !== null) previousUserId.current = userId;
  }, [userId, queryClient]);

  useEffect(() => {
    const onExpired = () => {
      const state = useAuthStore.getState();
      if (state.status === "authenticated") state.expire();
      void queryClient.cancelQueries();
    };
    window.addEventListener("fleet:session-expired", onExpired);
    return () => window.removeEventListener("fleet:session-expired", onExpired);
  }, [queryClient]);

  return <>{children}</>;
}

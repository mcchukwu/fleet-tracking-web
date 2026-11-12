import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/instance";
import { meQueryOptions } from "../api/hooks/auth";
import { queryKeys } from "../api/keys";
import { startPersistedCache, stopPersistedCache } from "../api/persistedCache";
import { normalize } from "../errors/normalize";
import { recordError } from "../errors/report";
import { claimImportHistory, wipeDeviceData } from "../lib/importHistory";
import { useConnectionStore } from "../stores/connection";
import { saveOfflineProfile } from "./offlineProfile";
import { useAuthStore } from "./store";

function reportStorageFailure(cause: unknown): void {
  recordError(
    normalize(cause, {
      action: "clear device data",
      resource: "device storage",
    }),
  );
}

function reportProfileFailure(cause: unknown): void {
  recordError(
    normalize(cause, {
      action: "save the offline profile",
      resource: "device storage",
    }),
  );
}

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
  const user = useAuthStore((state) => state.user);
  const userId = user?.id ?? null;
  const status = useAuthStore((state) => state.status);
  const verified = useAuthStore((state) => state.sessionVerified);
  const network = useConnectionStore((state) => state.network);
  const previousUserId = useRef<string | null>(null);
  const resetRef = useRef<Promise<void>>(Promise.resolve());
  const verifying = useRef(false);

  useEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = userId;

    if (userId === null) {
      if (previous !== null) {
        stopPersistedCache();
        void queryClient.cancelQueries({ queryKey: queryKeys.me });
        queryClient.clear();
        resetRef.current = wipeDeviceData().catch(reportStorageFailure);
      }
      return;
    }

    if (previous !== null && previous !== userId) {
      stopPersistedCache();
      void queryClient.cancelQueries({ queryKey: queryKeys.me });
      queryClient.clear();
      resetRef.current = wipeDeviceData().catch(reportStorageFailure);
    }

    void resetRef.current.then(() =>
      claimImportHistory(userId)
        .then((previousOwner) => {
          if (previousOwner !== null && previousOwner !== userId) queryClient.clear();
        })
        .catch(reportStorageFailure),
    );
  }, [userId, queryClient]);

  useEffect(() => {
    if (status !== "authenticated" || userId === null) {
      stopPersistedCache();
      return;
    }
    return startPersistedCache(queryClient);
  }, [status, userId, queryClient]);

  useEffect(() => {
    if (status !== "authenticated" || !verified || !user) return;
    void resetRef.current
      .then(() => {
        const current = useAuthStore.getState().user;
        if (current?.id !== user.id) return;
        return saveOfflineProfile(current);
      })
      .catch(reportProfileFailure);
  }, [status, verified, user]);

  useEffect(() => {
    if (status !== "authenticated" || verified || network !== "online") return;
    if (verifying.current) return;
    verifying.current = true;
    void queryClient
      .fetchQuery({ ...meQueryOptions(), staleTime: 0 })
      .then((response) => {
        const current = useAuthStore.getState();
        if (current.status !== "authenticated" || current.user?.id !== userId) return;
        api.setCsrfToken(response.csrf_token);
        useAuthStore.getState().setSession(response.user, response.csrf_token);
      })
      .catch((cause: unknown) => {
        const error = normalize(cause, { action: "verify the session", resource: "me" });
        if (error.kind === "unauthenticated") handleSessionExpired();
      })
      .finally(() => {
        verifying.current = false;
      });
  }, [status, verified, network, queryClient, userId]);

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

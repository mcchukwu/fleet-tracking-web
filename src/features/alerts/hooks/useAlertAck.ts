import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAckAlert } from "../../../api/hooks/alerts";
import { api } from "../../../api/instance";
import { queryKeys } from "../../../api/keys";
import type { Alert } from "../../../api/types";
import { errorCopy } from "../../../errors/catalog";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";
import { useActionError } from "../../../errors/useActionError";
import { useConnectionStore } from "../../../stores/connection";
import { useToast } from "../../../ui/Toast";

export type AckOutcome =
  | "acked"
  | "already_acked"
  | "gone"
  | "still_open"
  | "forbidden"
  | "offline"
  | "unsaved"
  | "unknown"
  | "failed"
  | "ignored";

export interface AckErrorState {
  alertId: string;
  error: AppError;
  title: string;
  detail: string;
}

export interface AckController {
  acknowledge: (alert: Alert) => Promise<AckOutcome>;
  pendingId: string | null;
  error: AckErrorState | null;
  clearError: () => void;
}

async function findFresh(alert: Alert): Promise<Alert | "missing"> {
  const response = await api.alerts({ type: alert.type, limit: 500 });
  return response.data.find((row) => row.id === alert.id) ?? "missing";
}

export function useAlertAck({ canAck }: { canAck: boolean }): AckController {
  const mutation = useAckAlert();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { run } = useActionError();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<AckErrorState | null>(null);
  const inFlight = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const acknowledge = useCallback(
    async (alert: Alert): Promise<AckOutcome> => {
      if (inFlight.current) return "ignored";
      if (!canAck) {
        setError({
          alertId: alert.id,
          error: normalize(new Error("forbidden"), { action: "acknowledge alerts" }),
          title: "Couldn't acknowledge",
          detail: "Your role can't acknowledge alerts.",
        });
        return "forbidden";
      }
      if (useConnectionStore.getState().network === "offline") {
        setError({
          alertId: alert.id,
          error: normalize(new TypeError("Failed to fetch"), { action: "acknowledge alerts" }),
          title: "You're offline",
          detail: "Changes are disabled until you're back online.",
        });
        return "offline";
      }

      inFlight.current = true;
      setPendingId(alert.id);
      setError(null);

      try {
        const result = await run(() => mutation.mutateAsync(alert.id), {
          action: "acknowledge alerts",
          resource: "the alert",
          reconcile: async () => {
            const fresh = await findFresh(alert);
            if (fresh === "missing") return "unknown";
            return fresh.status === "acked" ? "saved" : "not_saved";
          },
        });

        if (result.status === "success" || result.status === "reconciled") {
          // The mutation's onSuccess ran only for a normal response; a lost
          // response that the refetch proved saved still needs the refetch.
          if (result.status === "reconciled") {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["alerts"] }),
              queryClient.invalidateQueries({ queryKey: queryKeys.systemHealth }),
            ]);
          }
          toast({
            title: "Acknowledged.",
            tone: "success",
            key: `acked:${alert.id}`,
          });
          return "acked";
        }

        const failure = result.error;

        if (failure.kind === "not_found") {
          await queryClient.invalidateQueries({ queryKey: ["alerts"] });
          let fresh: Alert | "missing";
          try {
            fresh = await findFresh(alert);
          } catch {
            setError({
              alertId: alert.id,
              error: failure,
              title: "Couldn't acknowledge",
              detail: "We couldn't confirm that it was acknowledged. Check the alert before trying again.",
            });
            return "unknown";
          }
          if (fresh !== "missing" && fresh.status === "acked") {
            toast({
              title: "This alert was acknowledged elsewhere.",
              tone: "info",
              key: `acked-elsewhere:${alert.id}`,
            });
            return "already_acked";
          }
          if (fresh === "missing") {
            toast({
              title: "This alert no longer exists.",
              tone: "info",
              key: `gone:${alert.id}`,
            });
            return "gone";
          }
          setError({
            alertId: alert.id,
            error: failure,
            title: "This alert is still open.",
            detail: "Try again.",
          });
          return "still_open";
        }

        if (failure.kind === "unauthenticated") {
          setError({
            alertId: alert.id,
            error: failure,
            title: "Your session expired",
            detail: "Sign in, then try again.",
          });
          return "failed";
        }

        if (failure.kind === "forbidden") {
          setError({
            alertId: alert.id,
            error: failure,
            title: "Couldn't acknowledge",
            detail: "Your role can't acknowledge alerts.",
          });
          return "forbidden";
        }

        if (failure.outcome === "unknown") {
          setError({
            alertId: alert.id,
            error: failure,
            title: "Couldn't confirm that it was acknowledged.",
            detail: "Check the alert before trying again.",
          });
          return "unknown";
        }

        if (failure.kind === "network" || failure.kind === "timeout") {
          setError({
            alertId: alert.id,
            error: failure,
            title: "It wasn't saved.",
            detail: "Try again.",
          });
          return "unsaved";
        }

        setError({
          alertId: alert.id,
          error: failure,
          title: "Couldn't acknowledge",
          detail: errorCopy(failure).detail,
        });
        return "failed";
      } finally {
        inFlight.current = false;
        setPendingId(null);
      }
    },
    [canAck, mutation, queryClient, run, toast],
  );

  return { acknowledge, pendingId, error, clearError };
}

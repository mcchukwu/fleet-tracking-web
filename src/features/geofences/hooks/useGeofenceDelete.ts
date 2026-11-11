import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/instance";
import { queryKeys } from "../../../api/keys";
import { useDeleteGeofence } from "../../../api/hooks/geofences";
import type { Geofence } from "../../../api/types";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";
import { useActionError } from "../../../errors/useActionError";
import { useToast } from "../../../ui/Toast";
import { reconcileGeofenceDelete } from "../lib/reconcile";

export type GeofenceDeleteOutcome =
  | { status: "deleted" }
  | { status: "reconciled" }
  | { status: "blocked"; error: AppError }
  | { status: "gone" }
  | { status: "ignored" }
  | { status: "error"; error: AppError };

export interface GeofenceDeleteController {
  remove: (geofence: Geofence) => Promise<GeofenceDeleteOutcome>;
  cancel: () => void;
  retry: () => void;
  pending: boolean;
  error: AppError | null;
  reset: () => void;
}

function markWriteUnknown(cause: unknown): AppError {
  const error = normalize(cause, { action: "delete a geofence", resource: "the geofence" }, {
    outcome: "unknown",
  });
  if (
    error.outcome === "unknown" &&
    error.kind !== "network" &&
    error.kind !== "timeout" &&
    error.kind !== "aborted"
  ) {
    return { ...error, outcome: "failed" };
  }
  return error;
}

async function fetchFreshGeofences(): Promise<Geofence[]> {
  const response = await api.geofences();
  return response.data;
}

export function useGeofenceDelete(): GeofenceDeleteController {
  const queryClient = useQueryClient();
  const mutation = useDeleteGeofence();
  const { toast } = useToast();
  const { pending, error, run, reset } = useActionError();
  const inFlight = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const retryRequested = useRef(false);

  const invalidateGeofences = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.geofences });
  }, [queryClient]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted) return;
    retryRequested.current = true;
    controller.abort();
  }, []);

  const attempt = useCallback(
    async (geofence: Geofence, signal: AbortSignal): Promise<GeofenceDeleteOutcome> => {
      const result = await run(
        () =>
          mutation.mutateAsync({ id: geofence.id, signal }).catch((cause: unknown) => {
            throw markWriteUnknown(cause);
          }),
        {
          action: "delete a geofence",
          resource: "the geofence",
          reconcile: async () =>
            reconcileGeofenceDelete(await fetchFreshGeofences(), geofence.id),
        },
      );

      if (result.status === "success") {
        toast({ title: "Geofence deleted.", tone: "success", key: `geofence-deleted:${geofence.id}` });
        return { status: "deleted" };
      }
      if (result.status === "reconciled") {
        await invalidateGeofences();
        toast({ title: "It was deleted.", tone: "success", key: `geofence-deleted:${geofence.id}` });
        return { status: "reconciled" };
      }

      const failure = result.error;
      if (failure.kind === "conflict") {
        return { status: "blocked", error: failure };
      }
      if (failure.kind === "not_found") {
        await invalidateGeofences();
        return { status: "gone" };
      }
      return { status: "error", error: failure };
    },
    [invalidateGeofences, mutation, run, toast],
  );

  const remove = useCallback(
    async (geofence: Geofence): Promise<GeofenceDeleteOutcome> => {
      if (inFlight.current) return { status: "ignored" };
      inFlight.current = true;
      try {
        for (;;) {
          const controller = new AbortController();
          controllerRef.current = controller;
          try {
            const outcome = await attempt(geofence, controller.signal);
            const retryable =
              retryRequested.current &&
              outcome.status === "error" &&
              outcome.error.outcome === "failed";
            retryRequested.current = false;
            if (!retryable) return outcome;
          } finally {
            controllerRef.current = null;
          }
        }
      } finally {
        inFlight.current = false;
        retryRequested.current = false;
      }
    },
    [attempt],
  );

  return { remove, cancel, retry, pending, error, reset };
}

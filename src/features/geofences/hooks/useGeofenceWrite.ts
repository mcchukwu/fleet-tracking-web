import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/instance";
import { queryKeys } from "../../../api/keys";
import { useCreateGeofence, useUpdateGeofence } from "../../../api/hooks/geofences";
import type { Geofence, GeofenceInput, GeofenceUpdate } from "../../../api/types";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";
import { useActionError } from "../../../errors/useActionError";
import { useToast } from "../../../ui/Toast";
import { findCreatedGeofence, reconcileGeofenceUpdate } from "../lib/reconcile";

export type GeofenceCreateOutcome =
  | { status: "created"; id: string }
  | { status: "reconciled"; id: string | null }
  | { status: "ignored" }
  | { status: "error"; error: AppError };

export type GeofenceUpdateOutcome =
  | { status: "done"; reconciled: boolean }
  | { status: "gone" }
  | { status: "ignored" }
  | { status: "error"; error: AppError };

export interface GeofenceWriteController {
  create: (
    input: GeofenceInput,
    beforeSubmitIds: ReadonlySet<string>,
  ) => Promise<GeofenceCreateOutcome>;
  update: (geofence: Geofence, update: GeofenceUpdate) => Promise<GeofenceUpdateOutcome>;
  cancel: () => void;
  retry: () => void;
  pending: boolean;
  error: AppError | null;
  reset: () => void;
}

function markWriteUnknown(cause: unknown, action: string): AppError {
  const error = normalize(cause, { action, resource: "the geofence" }, { outcome: "unknown" });
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

export function useGeofenceWrite(): GeofenceWriteController {
  const queryClient = useQueryClient();
  const createMutation = useCreateGeofence();
  const updateMutation = useUpdateGeofence();
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

  const attemptCreate = useCallback(
    async (
      input: GeofenceInput,
      beforeSubmitIds: ReadonlySet<string>,
      signal: AbortSignal,
    ): Promise<GeofenceCreateOutcome> => {
      let savedId: string | null = null;
      const result = await run(
        () =>
          createMutation.mutateAsync({ input, signal }).catch((cause: unknown) => {
            throw markWriteUnknown(cause, "create a geofence");
          }),
        {
          action: "create a geofence",
          resource: "the geofence",
          reconcile: async () => {
            const rows = await fetchFreshGeofences();
            const match = findCreatedGeofence(rows, input, beforeSubmitIds);
            savedId = match?.id ?? null;
            return match ? "saved" : "not_saved";
          },
        },
      );

      if (result.status === "success") {
        toast({ title: "Geofence created.", tone: "success", key: "geofence-created" });
        return { status: "created", id: result.value.id };
      }
      if (result.status === "reconciled") {
        await invalidateGeofences();
        toast({ title: "It was saved.", tone: "success", key: "geofence-created" });
        return { status: "reconciled", id: savedId };
      }
      return { status: "error", error: result.error };
    },
    [createMutation, invalidateGeofences, run, toast],
  );

  const attemptUpdate = useCallback(
    async (
      geofence: Geofence,
      update: GeofenceUpdate,
      signal: AbortSignal,
    ): Promise<GeofenceUpdateOutcome> => {
      const result = await run(
        () =>
          updateMutation
            .mutateAsync({ id: geofence.id, update, signal })
            .catch((cause: unknown) => {
              throw markWriteUnknown(cause, "edit a geofence");
            }),
        {
          action: "edit a geofence",
          resource: "the geofence",
          reconcile: async () =>
            reconcileGeofenceUpdate(await fetchFreshGeofences(), geofence.id, update),
        },
      );

      if (result.status === "success") {
        toast({
          title: "Geofence updated.",
          tone: "success",
          key: `geofence-updated:${geofence.id}`,
        });
        return { status: "done", reconciled: false };
      }
      if (result.status === "reconciled") {
        await invalidateGeofences();
        toast({
          title: "It was saved.",
          tone: "success",
          key: `geofence-updated:${geofence.id}`,
        });
        return { status: "done", reconciled: true };
      }
      if (result.error.kind === "not_found") {
        await invalidateGeofences();
        return { status: "gone" };
      }
      return { status: "error", error: result.error };
    },
    [invalidateGeofences, run, toast, updateMutation],
  );

  async function loop<T>(
    task: (signal: AbortSignal) => Promise<T>,
    retryable: (outcome: T) => boolean,
  ): Promise<T | { status: "ignored" }> {
    if (inFlight.current) return { status: "ignored" };
    inFlight.current = true;
    try {
      for (;;) {
        const controller = new AbortController();
        controllerRef.current = controller;
        try {
          const outcome = await task(controller.signal);
          if (!(retryRequested.current && retryable(outcome))) {
            retryRequested.current = false;
            return outcome;
          }
          retryRequested.current = false;
        } finally {
          controllerRef.current = null;
        }
      }
    } finally {
      inFlight.current = false;
      retryRequested.current = false;
    }
  }

  const create = useCallback(
    async (
      input: GeofenceInput,
      beforeSubmitIds: ReadonlySet<string>,
    ): Promise<GeofenceCreateOutcome> =>
      loop(
        (signal) => attemptCreate(input, beforeSubmitIds, signal),
        (outcome) => outcome.status === "error" && outcome.error.outcome === "failed",
      ),
    [attemptCreate],
  );

  const update = useCallback(
    async (geofence: Geofence, patch: GeofenceUpdate): Promise<GeofenceUpdateOutcome> =>
      loop(
        (signal) => attemptUpdate(geofence, patch, signal),
        (outcome) => outcome.status === "error" && outcome.error.outcome === "failed",
      ),
    [attemptUpdate],
  );

  return { create, update, cancel, retry, pending, error, reset };
}

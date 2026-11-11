import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/instance";
import { queryKeys } from "../../../api/keys";
import { useCreateDriver, useUpdateDriver } from "../../../api/hooks/drivers";
import type { Driver, DriverInput, DriverUpdate } from "../../../api/types";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";
import { useActionError } from "../../../errors/useActionError";
import { useToast } from "../../../ui/Toast";
import { reconcileCreatedDriver, reconcileDriverUpdate } from "../lib/reconcile";

export type DriverCreateOutcome =
  | { status: "created" }
  | { status: "reconciled" }
  | { status: "ignored" }
  | { status: "error"; error: AppError };

export type DriverUpdateOutcome =
  | { status: "done"; reconciled: boolean }
  | { status: "gone" }
  | { status: "ignored" }
  | { status: "error"; error: AppError };

export interface DriverWriteController {
  create: (input: DriverInput, beforeSubmitIds: ReadonlySet<string>) => Promise<DriverCreateOutcome>;
  update: (driver: Driver, update: DriverUpdate) => Promise<DriverUpdateOutcome>;
  /** Abort the in-flight write and reconcile what the server did with it. */
  cancel: () => void;
  /** Abort the in-flight write and send it again once it is known not to have landed. */
  retry: () => void;
  pending: boolean;
  error: AppError | null;
  reset: () => void;
}

function markWriteUnknown(cause: unknown, action: string): AppError {
  const error = normalize(cause, { action, resource: "the driver" }, { outcome: "unknown" });
  // A cancelled or unanswered write may still have reached the server.
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

async function fetchFreshDrivers(): Promise<Driver[]> {
  const response = await api.drivers();
  return response.data;
}

/** A status edit names its own toast; every other edit is a plain update. */
function updateToast(update: DriverUpdate): string {
  if (update.status === "inactive") return "Driver deactivated.";
  if (update.status === "active") return "Driver activated.";
  return "Driver updated.";
}

/** Status changes need their own dedupe key, or activate and deactivate collapse. */
function updateToastKey(driver: Driver, update: DriverUpdate): string {
  return update.status
    ? `driver-status:${driver.id}:${update.status}`
    : `driver-updated:${driver.id}`;
}

export function useDriverWrite(): DriverWriteController {
  const queryClient = useQueryClient();
  const createMutation = useCreateDriver();
  const updateMutation = useUpdateDriver();
  const { toast } = useToast();
  const { pending, error, run, reset } = useActionError();
  const inFlight = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const retryRequested = useRef(false);

  const invalidateDrivers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.drivers });
  }, [queryClient]);

  const invalidateAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers }),
      queryClient.invalidateQueries({ queryKey: queryKeys.liveSnapshot }),
      queryClient.invalidateQueries({ queryKey: ["vehicle"] }),
      queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
      queryClient.invalidateQueries({ queryKey: ["trips"] }),
    ]);
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
      input: DriverInput,
      beforeSubmitIds: ReadonlySet<string>,
      signal: AbortSignal,
    ): Promise<DriverCreateOutcome> => {
      const result = await run(
        () =>
          createMutation.mutateAsync({ input, signal }).catch((cause: unknown) => {
            throw markWriteUnknown(cause, "create a driver");
          }),
        {
          action: "create a driver",
          resource: "the driver",
          reconcile: async () =>
            reconcileCreatedDriver(await fetchFreshDrivers(), input, beforeSubmitIds),
        },
      );

      if (result.status === "success") {
        toast({ title: "Driver created.", tone: "success", key: "driver-created" });
        return { status: "created" };
      }
      if (result.status === "reconciled") {
        await invalidateDrivers();
        toast({ title: "It was saved.", tone: "success", key: "driver-created" });
        return { status: "reconciled" };
      }
      return { status: "error", error: result.error };
    },
    [createMutation, invalidateDrivers, run, toast],
  );

  const attemptUpdate = useCallback(
    async (
      driver: Driver,
      update: DriverUpdate,
      signal: AbortSignal,
    ): Promise<DriverUpdateOutcome> => {
      const result = await run(
        () =>
          updateMutation.mutateAsync({ id: driver.id, update, signal }).catch((cause: unknown) => {
            throw markWriteUnknown(cause, "edit a driver");
          }),
        {
          action: "edit a driver",
          resource: "the driver",
          reconcile: async () =>
            reconcileDriverUpdate(
              (await fetchFreshDrivers()).find((row) => row.id === driver.id),
              update,
            ),
        },
      );

      if (result.status === "success") {
        toast({ title: updateToast(update), tone: "success", key: updateToastKey(driver, update) });
        return { status: "done", reconciled: false };
      }
      if (result.status === "reconciled") {
        await invalidateAll();
        toast({ title: updateToast(update), tone: "success", key: updateToastKey(driver, update) });
        return { status: "done", reconciled: true };
      }

      const failure = result.error;
      if (failure.kind === "not_found") {
        // Keep the error visible: the form offers Refresh and stays open.
        await invalidateAll();
        return { status: "gone" };
      }
      return { status: "error", error: failure };
    },
    [invalidateAll, run, toast, updateMutation],
  );

  const create = useCallback(
    async (
      input: DriverInput,
      beforeSubmitIds: ReadonlySet<string>,
    ): Promise<DriverCreateOutcome> => {
      if (inFlight.current) return { status: "ignored" };
      inFlight.current = true;
      try {
        for (;;) {
          const controller = new AbortController();
          controllerRef.current = controller;
          try {
            const outcome = await attemptCreate(input, beforeSubmitIds, controller.signal);
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
    [attemptCreate],
  );

  const update = useCallback(
    async (driver: Driver, update: DriverUpdate): Promise<DriverUpdateOutcome> => {
      if (inFlight.current) return { status: "ignored" };
      inFlight.current = true;
      try {
        for (;;) {
          const controller = new AbortController();
          controllerRef.current = controller;
          try {
            const outcome = await attemptUpdate(driver, update, controller.signal);
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
    [attemptUpdate],
  );

  return { create, update, cancel, retry, pending, error, reset };
}

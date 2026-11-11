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
  pending: boolean;
  error: AppError | null;
  reset: () => void;
}

function markWriteUnknown(cause: unknown, action: string): AppError {
  const error = normalize(cause, { action, resource: "the driver" }, { outcome: "unknown" });
  if (error.outcome === "unknown" && error.kind !== "network" && error.kind !== "timeout") {
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

  const create = useCallback(
    async (
      input: DriverInput,
      beforeSubmitIds: ReadonlySet<string>,
    ): Promise<DriverCreateOutcome> => {
      if (inFlight.current) return { status: "ignored" };
      inFlight.current = true;
      try {
        const result = await run(
          () =>
            createMutation.mutateAsync(input).catch((cause: unknown) => {
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
      } finally {
        inFlight.current = false;
      }
    },
    [createMutation, invalidateDrivers, run, toast],
  );

  const update = useCallback(
    async (driver: Driver, update: DriverUpdate): Promise<DriverUpdateOutcome> => {
      if (inFlight.current) return { status: "ignored" };
      inFlight.current = true;
      try {
        const result = await run(
          () =>
            updateMutation.mutateAsync({ id: driver.id, update }).catch((cause: unknown) => {
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
      } finally {
        inFlight.current = false;
      }
    },
    [invalidateAll, run, toast, updateMutation],
  );

  return { create, update, pending, error, reset };
}

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Vehicle, VehicleUpdate } from "../../../api/types";
import { useUpdateVehicle, vehicleQueryOptions } from "../../../api/hooks/vehicles";
import { queryKeys } from "../../../api/keys";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";
import {
  useActionError,
  type ActionResult,
  type ReconcileOutcome,
} from "../../../errors/useActionError";

const WRITE_ONLY_FIELDS = new Set(["sim_number", "device_model", "protocol"]);

/** A write that may have reached the server is unknown until it is reconciled. */
function markWriteUnknown(cause: unknown): AppError {
  const error = normalize(
    cause,
    { action: "update the vehicle", resource: "the vehicle" },
    { outcome: "unknown" },
  );
  if (error.outcome === "unknown" && error.kind !== "network" && error.kind !== "timeout") {
    return { ...error, outcome: "failed" };
  }
  return error;
}

function comparable(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

/** Compare the intended fields with a fresh read; write-only fields cannot be confirmed. */
export function reconcileVehicle(fresh: Vehicle, update: VehicleUpdate): ReconcileOutcome {
  const readable = (Object.keys(update) as Array<keyof VehicleUpdate>).filter(
    (key) => !WRITE_ONLY_FIELDS.has(key),
  );
  if (readable.length === 0) return "unknown";

  for (const key of readable) {
    const intended = comparable(update[key]);
    const actual = comparable(fresh[key as keyof Vehicle]);
    if (intended !== actual) return "not_saved";
  }
  return "saved";
}

export type VehicleWriteResult = ActionResult<unknown> | { status: "ignored" };

export function useVehicleWrite(id: string) {
  const queryClient = useQueryClient();
  const mutation = useUpdateVehicle(id);
  const { pending, error, run, reset } = useActionError();
  const inFlight = useRef(false);

  const invalidate = useCallback(
    async (update: VehicleUpdate) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.vehicle(id) }),
        queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.liveSnapshot }),
      ];
      if (update.driver_id !== undefined) {
        invalidations.push(queryClient.invalidateQueries({ queryKey: queryKeys.drivers }));
      }
      await Promise.all(invalidations);
    },
    [id, queryClient],
  );

  const submit = useCallback(
    async (update: VehicleUpdate): Promise<VehicleWriteResult> => {
      if (inFlight.current) return { status: "ignored" };
      inFlight.current = true;
      try {
        const result = await run(
          () =>
            mutation.mutateAsync(update).catch((cause: unknown) => {
              throw markWriteUnknown(cause);
            }),
          {
            action: "update the vehicle",
            resource: "the vehicle",
            reconcile: async () => {
              const fresh = await queryClient.fetchQuery({
                ...vehicleQueryOptions(id),
                staleTime: 0,
              });
              return reconcileVehicle(fresh, update);
            },
          },
        );
        if (result.status === "reconciled") await invalidate(update);
        return result;
      } finally {
        inFlight.current = false;
      }
    },
    [id, invalidate, mutation, queryClient, run],
  );

  return { submit, pending, error, reset };
}

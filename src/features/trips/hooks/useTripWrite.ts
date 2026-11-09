import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/instance";
import { queryKeys } from "../../../api/keys";
import { useCreateTrip, useUpdateTrip } from "../../../api/hooks/trips";
import type { Trip, TripInput, TripUpdate } from "../../../api/types";
import { errorCopy } from "../../../errors/catalog";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";
import { useActionError } from "../../../errors/useActionError";
import { tripStatusLabel } from "../../../lib/status";
import {
  reconcileCreatedTrip,
  reconcileTripTransition,
  transitionToast,
  type TripAction,
} from "../../../lib/trips";
import { useToast } from "../../../ui/Toast";

export type TripCreateOutcome =
  | { status: "created" }
  | { status: "reconciled" }
  | { status: "ignored" }
  | { status: "error"; error: AppError };

export type TripTransitionOutcome =
  | { status: "done"; reconciled: boolean }
  | { status: "gone" }
  | { status: "conflict"; currentStatus: string | null }
  | { status: "ignored" }
  | { status: "error"; error: AppError };

export interface TripWriteController {
  create: (input: TripInput, beforeSubmitIds: ReadonlySet<string>) => Promise<TripCreateOutcome>;
  transition: (trip: Trip, update: TripUpdate, action: TripAction) => Promise<TripTransitionOutcome>;
  pending: boolean;
  error: AppError | null;
  reset: () => void;
}

export interface TripWriteCopy {
  title: string;
  detail: string;
}

/** Copy for a failed create or transition; never raw server text. */
export function tripWriteCopy(
  error: AppError,
  mode: "create" | "change",
): TripWriteCopy {
  if (error.kind === "not_found") {
    return {
      title: "This trip no longer exists.",
      detail: "We've refreshed the list.",
    };
  }
  if (error.kind === "conflict") {
    return {
      title: "This trip changed elsewhere.",
      detail: "We've refreshed it.",
    };
  }
  if (error.kind === "forbidden") {
    return {
      title: mode === "create" ? "Your role can't create trips." : "Your role can't change trips.",
      detail: "Ask an administrator to review your role.",
    };
  }
  if (error.kind === "unauthenticated") {
    return { title: "Your session expired", detail: "Sign in, then try again." };
  }
  if (error.outcome === "unknown") {
    return {
      title: "We couldn't confirm that it saved.",
      detail:
        mode === "create"
          ? "Check the trips list before trying again."
          : "Check the trip before trying again.",
    };
  }
  if (error.kind === "network" || error.kind === "timeout") {
    return { title: "It wasn't saved.", detail: "Try again." };
  }
  return errorCopy(error);
}

function markWriteUnknown(cause: unknown, action: string): AppError {
  const error = normalize(cause, { action, resource: "the trip" }, { outcome: "unknown" });
  if (error.outcome === "unknown" && error.kind !== "network" && error.kind !== "timeout") {
    return { ...error, outcome: "failed" };
  }
  return error;
}

async function fetchFreshTrips(): Promise<Trip[]> {
  const response = await api.trips({ limit: 500 });
  return response.data;
}

export function useTripWrite(): TripWriteController {
  const queryClient = useQueryClient();
  const createMutation = useCreateTrip();
  const updateMutation = useUpdateTrip();
  const { toast } = useToast();
  const { pending, error, run, reset } = useActionError();
  const inFlight = useRef(false);

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["trips"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.liveSnapshot }),
      queryClient.invalidateQueries({ queryKey: queryKeys.systemHealth }),
    ]);
  }, [queryClient]);

  const create = useCallback(
    async (
      input: TripInput,
      beforeSubmitIds: ReadonlySet<string>,
    ): Promise<TripCreateOutcome> => {
      if (inFlight.current) return { status: "ignored" };
      inFlight.current = true;
      try {
        const result = await run(
          () =>
            createMutation.mutateAsync(input).catch((cause: unknown) => {
              throw markWriteUnknown(cause, "create a trip");
            }),
          {
            action: "create a trip",
            resource: "the trip",
            reconcile: async () =>
              reconcileCreatedTrip(await fetchFreshTrips(), input, beforeSubmitIds),
          },
        );

        if (result.status === "success") {
          await invalidate();
          toast({ title: "Trip created.", tone: "success", key: "trip-created" });
          return { status: "created" };
        }
        if (result.status === "reconciled") {
          await invalidate();
          toast({ title: "It was saved.", tone: "success", key: "trip-created" });
          return { status: "reconciled" };
        }
        return { status: "error", error: result.error };
      } finally {
        inFlight.current = false;
      }
    },
    [createMutation, invalidate, run, toast],
  );

  const transition = useCallback(
    async (
      trip: Trip,
      update: TripUpdate,
      action: TripAction,
    ): Promise<TripTransitionOutcome> => {
      if (inFlight.current) return { status: "ignored" };
      inFlight.current = true;
      try {
        const result = await run(
          () =>
            updateMutation.mutateAsync({ id: trip.id, update }).catch((cause: unknown) => {
              throw markWriteUnknown(cause, "update the trip");
            }),
          {
            action: "update the trip",
            resource: "the trip",
            reconcile: async () =>
              reconcileTripTransition(
                (await fetchFreshTrips()).find((row) => row.id === trip.id),
                update,
              ),
          },
        );

        if (result.status === "success") {
          toast({ title: transitionToast(action), tone: "success", key: `trip-${action}:${trip.id}` });
          return { status: "done", reconciled: false };
        }
        if (result.status === "reconciled") {
          await invalidate();
          toast({ title: transitionToast(action), tone: "success", key: `trip-${action}:${trip.id}` });
          return { status: "done", reconciled: true };
        }

        const failure = result.error;
        if (failure.kind === "not_found") {
          await invalidate();
          reset();
          toast({
            title: "This trip no longer exists. We've refreshed the list.",
            tone: "info",
            key: `trip-gone:${trip.id}`,
          });
          return { status: "gone" };
        }
        if (failure.kind === "conflict") {
          await invalidate();
          reset();
          let currentStatus: string | null = null;
          try {
            const fresh = await fetchFreshTrips();
            currentStatus = fresh.find((row) => row.id === trip.id)?.status ?? null;
          } catch {
            currentStatus = null;
          }
          toast({
            title:
              currentStatus === null
                ? "This trip changed elsewhere. We've refreshed it."
                : `This trip is already ${tripStatusLabel(currentStatus)}. We've refreshed it.`,
            tone: "info",
            key: `trip-conflict:${trip.id}`,
          });
          return { status: "conflict", currentStatus };
        }
        return { status: "error", error: failure };
      } finally {
        inFlight.current = false;
      }
    },
    [invalidate, reset, run, toast, updateMutation],
  );

  return { create, transition, pending, error, reset };
}

import type { Geofence, GeofenceInput, GeofenceUpdate } from "../../../api/types";
import { errorCopy } from "../../../errors/catalog";
import type { AppError } from "../../../errors/types";
import type { ReconcileOutcome } from "../../../errors/useActionError";
import { geometryEquals } from "./geometry";

/** A create only returns `{ id }`; a match needs identity plus every intended field. */
export function findCreatedGeofence(
  geofences: readonly Geofence[],
  input: GeofenceInput,
  beforeSubmitIds: ReadonlySet<string>,
): Geofence | undefined {
  const name = input.name.trim();
  const kind = input.kind ?? "other";
  return geofences.find(
    (geofence) =>
      !beforeSubmitIds.has(geofence.id) &&
      geofence.name.trim() === name &&
      geofence.kind === kind &&
      geometryEquals(geofence.geometry, input.geometry),
  );
}

export function reconcileCreatedGeofence(
  geofences: readonly Geofence[],
  input: GeofenceInput,
  beforeSubmitIds: ReadonlySet<string>,
): ReconcileOutcome {
  return findCreatedGeofence(geofences, input, beforeSubmitIds) ? "saved" : "not_saved";
}

export function reconcileGeofenceUpdate(
  geofences: readonly Geofence[],
  id: string,
  update: GeofenceUpdate,
): ReconcileOutcome {
  const geofence = geofences.find((row) => row.id === id);
  if (!geofence) return "unknown";
  if (update.name !== undefined && geofence.name.trim() !== update.name.trim()) {
    return "not_saved";
  }
  if (update.kind !== undefined && geofence.kind !== update.kind) return "not_saved";
  if (update.geometry !== undefined && !geometryEquals(geofence.geometry, update.geometry)) {
    return "not_saved";
  }
  return "saved";
}

export function reconcileGeofenceDelete(
  geofences: readonly Geofence[],
  id: string,
): ReconcileOutcome {
  return geofences.some((row) => row.id === id) ? "not_saved" : "saved";
}

export interface GeofenceWriteCopy {
  title: string;
  detail: string;
}

function validationCopy(error: AppError): GeofenceWriteCopy | null {
  if (error.code === "invalid_geometry") {
    return {
      title: "The polygon isn't valid.",
      detail: error.serverMessage ?? "Adjust the points and try again.",
    };
  }
  if (error.code === "invalid_kind") {
    return {
      title: "Choose a kind.",
      detail: error.serverMessage ?? "Pick one of the four kinds.",
    };
  }
  return null;
}

/** Copy for a failed create or edit; never raw server text beyond an allowlisted code. */
export function geofenceWriteCopy(error: AppError, mode: "create" | "update"): GeofenceWriteCopy {
  const verb = mode === "create" ? "create" : "edit";
  if (error.kind === "validation") {
    const specific = validationCopy(error);
    if (specific) return specific;
  }
  if (error.kind === "not_found") {
    return {
      title: "This geofence no longer exists.",
      detail: "Refresh to see the latest list.",
    };
  }
  if (error.kind === "forbidden") {
    return {
      title: `Your role can't ${verb} geofences.`,
      detail: "Ask an administrator to review your role.",
    };
  }
  if (error.kind === "unauthenticated") {
    return { title: "Your session expired", detail: "Sign in, then try again." };
  }
  if (error.outcome === "unknown") {
    return {
      title: "We couldn't confirm that it saved.",
      detail: "Check the geofences list before trying again.",
    };
  }
  if (error.kind === "network" || error.kind === "timeout" || error.kind === "aborted") {
    return { title: "It wasn't saved.", detail: "Try again." };
  }
  return errorCopy(error);
}

/** Delete copy keeps the slice's fixed headline and quotes `in_use` as the detail. */
export function geofenceDeleteCopy(error: AppError): GeofenceWriteCopy {
  if (error.kind === "conflict" && error.code === "in_use") {
    return {
      title: "This geofence has recorded events and can't be deleted.",
      detail: error.serverMessage ?? "It is still referenced by recorded events.",
    };
  }
  if (error.kind === "not_found") {
    return {
      title: "This geofence no longer exists.",
      detail: "Refresh to see the latest list.",
    };
  }
  if (error.kind === "forbidden") {
    return {
      title: "Your role can't delete geofences.",
      detail: "Ask an administrator to review your role.",
    };
  }
  if (error.kind === "unauthenticated") {
    return { title: "Your session expired", detail: "Sign in, then try again." };
  }
  if (error.outcome === "unknown") {
    return {
      title: "We couldn't confirm that it was deleted.",
      detail: "Check the geofences list before trying again.",
    };
  }
  if (error.kind === "network" || error.kind === "timeout" || error.kind === "aborted") {
    return { title: "It wasn't deleted.", detail: "Try again." };
  }
  return errorCopy(error);
}

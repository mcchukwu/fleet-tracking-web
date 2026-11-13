import type { Driver, DriverInput, DriverUpdate } from "../../../api/types";
import { errorCopy } from "../../../errors/catalog";
import type { AppError } from "../../../errors/types";
import type { ReconcileOutcome } from "../../../errors/useActionError";

/**
 * A create only returns `{ id }`, so an unknown outcome is resolved by finding a
 * row that did not exist before the submit and matches the intended fields.
 */
export function reconcileCreatedDriver(
  drivers: readonly Driver[],
  input: DriverInput,
  beforeSubmitIds: ReadonlySet<string>,
): ReconcileOutcome {
  const name = input.name.trim();
  const phone = input.phone?.trim() ?? "";
  const licence = input.licence?.trim() ?? "";

  const match = drivers.find(
    (driver) =>
      !beforeSubmitIds.has(driver.id) &&
      driver.name.trim() === name &&
      driver.phone === phone &&
      driver.licence === licence,
  );
  return match ? "saved" : "not_saved";
}

/** Compare every intended field (trimmed) against the fresh row. */
export function reconcileDriverUpdate(
  driver: Driver | undefined,
  update: DriverUpdate,
): ReconcileOutcome {
  if (!driver) return "unknown";
  if (update.name !== undefined && driver.name.trim() !== update.name.trim()) return "not_saved";
  if (update.phone !== undefined && driver.phone !== update.phone.trim()) return "not_saved";
  if (update.licence !== undefined && driver.licence !== update.licence.trim()) return "not_saved";
  if (update.status !== undefined && driver.status !== update.status) return "not_saved";
  return "saved";
}

export interface DriverWriteCopy {
  title: string;
  detail: string;
}

/** Copy for a failed driver write; never raw server text. */
export function driverWriteCopy(error: AppError, mode: "create" | "update"): DriverWriteCopy {
  const verb = mode === "create" ? "create" : "edit";
  if (error.kind === "not_found") {
    return {
      title: "This driver no longer exists.",
      detail: "Refresh to see the latest list.",
    };
  }
  if (error.kind === "forbidden") {
    return {
      title: `Your role can't ${verb} drivers.`,
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
          ? "Check the drivers list before trying again."
          : "Check the driver before trying again.",
    };
  }
  if (error.kind === "network" || error.kind === "timeout") {
    return { title: "It wasn't saved.", detail: "Try again." };
  }
  return errorCopy(error);
}

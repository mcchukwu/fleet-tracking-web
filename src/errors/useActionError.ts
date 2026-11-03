import { useCallback, useState, type RefObject } from "react";
import { normalize } from "./normalize";
import { recordError } from "./report";
import type { AppError } from "./types";

export type ReconcileOutcome = "saved" | "not_saved" | "unknown";

export interface RunOptions {
  action?: string;
  resource?: string;
  reconcile?: () => Promise<ReconcileOutcome>;
  focusRef?: RefObject<HTMLElement | null>;
}

export type ActionResult<T> =
  | { status: "success"; value: T }
  | { status: "reconciled" }
  | { status: "error"; error: AppError };

export function useActionError() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const run = useCallback(
    async <T,>(action: () => Promise<T>, options: RunOptions = {}): Promise<ActionResult<T>> => {
      setPending(true);
      setError(null);

      try {
        const value = await action();
        setPending(false);
        return { status: "success", value };
      } catch (cause) {
        let normalized = normalize(
          cause,
          { action: options.action, resource: options.resource },
          { outcome: "failed" },
        );

        if (normalized.outcome === "unknown" && options.reconcile) {
          try {
            const outcome = await options.reconcile();
            if (outcome === "saved") {
              setPending(false);
              return { status: "reconciled" };
            }
            normalized = { ...normalized, outcome: outcome === "not_saved" ? "failed" : "unknown" };
          } catch (reconcileCause) {
            normalized = { ...normalized, outcome: "unknown", cause: reconcileCause };
          }
        }

        recordError(normalized);
        setError(normalized);
        setPending(false);
        options.focusRef?.current?.focus();
        return { status: "error", error: normalized };
      }
    },
    [],
  );

  const reset = useCallback(() => setError(null), []);

  return { pending, error, run, reset };
}

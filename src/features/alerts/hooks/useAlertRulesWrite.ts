import { useCallback, useRef, useState } from "react";
import { useUpdateAlertRule } from "../../../api/hooks/alerts";
import type { AlertRule } from "../../../api/types";
import { errorCopy } from "../../../errors/catalog";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";
import { useActionError } from "../../../errors/useActionError";
import { useConnectionStore } from "../../../stores/connection";
import { useToast } from "../../../ui/Toast";

export interface RuleWriteError {
  ruleId: string;
  error: AppError;
  title: string;
  detail: string;
}

export interface RuleWriteController {
  toggle: (rule: AlertRule, enabled: boolean) => Promise<"saved" | "failed" | "ignored">;
  saveConfig: (
    rule: AlertRule,
    config: Record<string, unknown>,
  ) => Promise<"saved" | "failed" | "ignored">;
  pendingId: string | null;
  error: RuleWriteError | null;
  clearError: () => void;
}

export function useAlertRulesWrite({
  canMutate,
}: {
  canMutate: boolean;
}): RuleWriteController {
  const mutation = useUpdateAlertRule();
  const { run } = useActionError();
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<RuleWriteError | null>(null);
  const inFlight = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const write = useCallback(
    async (
      rule: AlertRule,
      update: { enabled?: boolean; config?: Record<string, unknown> },
    ): Promise<"saved" | "failed" | "ignored"> => {
      if (inFlight.current) return "ignored";
      if (!canMutate) {
        setError({
          ruleId: rule.id,
          error: normalize(new Error("forbidden"), { action: "change alert rules" }),
          title: "Couldn't change alert rules",
          detail: "Your role can't change alert rules.",
        });
        return "failed";
      }
      if (useConnectionStore.getState().network === "offline") {
        setError({
          ruleId: rule.id,
          error: normalize(new TypeError("Failed to fetch"), { action: "change alert rules" }),
          title: "You're offline",
          detail: "Changes are disabled until you're back online.",
        });
        return "failed";
      }

      inFlight.current = true;
      setPendingId(rule.id);
      setError(null);

      try {
        const result = await run(() => mutation.mutateAsync({ id: rule.id, update }), {
          action: "change alert rules",
          resource: "the alert rule",
        });

        if (result.status === "success" || result.status === "reconciled") {
          toast({
            title: "Alert rule updated.",
            tone: "success",
            key: `alert-rule:${rule.id}`,
          });
          return "saved";
        }

        const failure = result.error;
        setError({
          ruleId: rule.id,
          error: failure,
          title: "Couldn't change alert rules",
          detail:
            failure.kind === "unauthenticated"
              ? "Your session expired. Sign in, then try again."
              : failure.kind === "forbidden"
                ? "Your role can't change alert rules."
                : errorCopy(failure).detail,
        });
        return "failed";
      } finally {
        inFlight.current = false;
        setPendingId(null);
      }
    },
    [canMutate, mutation, run, toast],
  );

  const toggle = useCallback(
    (rule: AlertRule, enabled: boolean) => write(rule, { enabled }),
    [write],
  );

  const saveConfig = useCallback(
    (rule: AlertRule, config: Record<string, unknown>) => write(rule, { config }),
    [write],
  );

  return { toggle, saveConfig, pendingId, error, clearError };
}

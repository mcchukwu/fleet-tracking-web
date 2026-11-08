import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateAlertRule } from "../../../api/hooks/alerts";
import { api } from "../../../api/instance";
import { queryKeys } from "../../../api/keys";
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

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The server replaces the whole config, so both key sets must match. */
function matchesUpdate(
  rule: AlertRule,
  update: { enabled?: boolean; config?: Record<string, unknown> },
): boolean {
  if (update.enabled !== undefined && rule.enabled !== update.enabled) return false;
  if (update.config !== undefined) {
    const keys = new Set([...Object.keys(update.config), ...Object.keys(rule.config)]);
    for (const key of keys) {
      if (!sameValue(update.config[key], rule.config[key])) return false;
    }
  }
  return true;
}

async function findRule(id: string): Promise<AlertRule | "missing"> {
  const response = await api.alertRules();
  return response.data.find((row) => row.id === id) ?? "missing";
}

export function useAlertRulesWrite({
  canMutate,
}: {
  canMutate: boolean;
}): RuleWriteController {
  const mutation = useUpdateAlertRule();
  const queryClient = useQueryClient();
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
          reconcile: async () => {
            const fresh = await findRule(rule.id);
            if (fresh === "missing") return "unknown";
            return matchesUpdate(fresh, update) ? "saved" : "not_saved";
          },
        });

        if (result.status === "success" || result.status === "reconciled") {
          if (result.status === "reconciled") {
            await queryClient.invalidateQueries({ queryKey: queryKeys.alertRules });
          }
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
                : failure.outcome === "unknown"
                  ? "We couldn't confirm that it saved. Check the rule before trying again."
                  : failure.kind === "network" || failure.kind === "timeout"
                    ? "It wasn't saved. Try again."
                    : errorCopy(failure).detail,
        });
        return "failed";
      } finally {
        inFlight.current = false;
        setPendingId(null);
      }
    },
    [canMutate, mutation, queryClient, run, toast],
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

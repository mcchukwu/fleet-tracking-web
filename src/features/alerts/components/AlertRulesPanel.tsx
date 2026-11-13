import { useAlertRules } from "../../../api/hooks/alerts";
import { useCanMutate } from "../../../auth/useCanMutate";
import { normalize } from "../../../errors/normalize";
import { formatClockTime } from "../../../lib/format";
import { useConnection } from "../../../stores/connection";
import { Banner } from "../../../ui/Banner";
import { EmptyState, LoadingState } from "../../../ui/StatePanel";
import { StateBoundary, type StateBoundaryState } from "../../../ui/StateBoundary";
import { useAlertRulesWrite } from "../hooks/useAlertRulesWrite";
import { AlertRuleRow } from "./AlertRuleRow";

export function AlertRulesPanel() {
  const query = useAlertRules();
  const mutate = useCanMutate("mutate", "Your role can't change alert rules.");
  const canMutate = mutate.allowed;
  const { network, lastDataAt } = useConnection();
  const offline = network === "offline";
  const write = useAlertRulesWrite({ canMutate });

  const error = !offline && query.error ? normalize(query.error) : null;
  const rules = query.data ?? [];
  const staleLabel = lastDataAt ? formatClockTime(lastDataAt) : undefined;

  const state: StateBoundaryState =
    error?.kind === "forbidden"
      ? "forbidden"
      : query.isLoading
        ? "loading"
        : error
          ? "error"
          : offline && rules.length > 0
            ? "stale"
            : rules.length === 0
              ? "empty"
              : "ready";

  const disabledReason = mutate.reason ?? undefined;

  return (
    <div className="flex flex-col gap-3 py-3">
      {mutate.blockedBy === "role" ? (
        <Banner message="Your role can't change alert rules." />
      ) : mutate.blockedBy === "offline" ? (
        <Banner message="You're offline. Changes are disabled." />
      ) : null}

      <StateBoundary
        state={state}
        error={error}
        onRetry={() => void query.refetch()}
        loading={<LoadingState rows={4} />}
        empty={
          offline ? (
            <EmptyState
              title="No alert rules available offline"
              description="Reconnect to load the alert rules."
            />
          ) : (
            <EmptyState
              title="No alert rules configured"
              description="Alert rules appear here when the server has any."
            />
          )
        }
        staleLabel={staleLabel}
      >
        {rules.length > 0 ? (
          <ul className="border-border bg-surface rounded-lg border px-4">
            {rules.map((rule) => (
              <AlertRuleRow
                key={rule.id}
                rule={rule}
                pending={write.pendingId === rule.id}
                error={write.error}
                disabledReason={disabledReason}
                onToggle={(row, enabled) => void write.toggle(row, enabled)}
                onSave={(row, config) => void write.saveConfig(row, config)}
              />
            ))}
          </ul>
        ) : null}
      </StateBoundary>
    </div>
  );
}

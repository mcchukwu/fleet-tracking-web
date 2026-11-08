import { useState, type ReactNode } from "react";
import type { AlertRule } from "../../../api/types";
import { alertTypeLabel, isAlertType } from "../../../lib/status";
import { formatEvidenceValue, humanizeEvidenceKey } from "../../../lib/evidence";
import { InlineError } from "../../../errors/InlineError";
import { Button } from "../../../ui/Button";
import { Checkbox } from "../../../ui/Checkbox";
import { Tooltip } from "../../../ui/Tooltip";
import type { RuleWriteError } from "../hooks/useAlertRulesWrite";
import { AlertRuleConfigForm } from "./AlertRuleConfigForm";

export interface AlertRuleRowProps {
  rule: AlertRule;
  pending: boolean;
  error: RuleWriteError | null;
  disabledReason?: string;
  onToggle: (rule: AlertRule, enabled: boolean) => void;
  onSave: (rule: AlertRule, config: Record<string, unknown>) => void;
}

export function AlertRuleRow({
  rule,
  pending,
  error,
  disabledReason,
  onToggle,
  onSave,
}: AlertRuleRowProps) {
  const [editing, setEditing] = useState(false);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const editable = isAlertType(rule.type);
  const hasConfig = Object.keys(rule.config).length > 0;
  const typeLabel = alertTypeLabel(rule.type);
  const roleDisabled = Boolean(disabledReason);

  function withReason(node: ReactNode): ReactNode {
    if (!roleDisabled || node === null) return node;
    return <Tooltip label={disabledReason ?? ""}>{node}</Tooltip>;
  }

  function toggle(enabled: boolean): void {
    setRetryAction(() => () => onToggle(rule, enabled));
    onToggle(rule, enabled);
  }

  function save(config: Record<string, unknown>): void {
    setRetryAction(() => () => onSave(rule, config));
    onSave(rule, config);
  }

  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        {withReason(
          <Checkbox
            label="Enabled"
            aria-label={`Enabled ${typeLabel} rule`}
            checked={rule.enabled}
            disabled={pending}
            aria-disabled={roleDisabled || undefined}
            onChange={(event) => {
              if (roleDisabled) return;
              toggle(event.target.checked);
            }}
            className={roleDisabled ? "cursor-not-allowed" : undefined}
          />,
        )}
        <p className="min-w-0 flex-1 text-sm font-medium text-text">{typeLabel}</p>
        {withReason(
          editable && hasConfig ? (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`${editing ? "Hide settings" : "Edit settings"} for ${typeLabel}`}
              aria-expanded={editing}
              aria-disabled={roleDisabled || undefined}
              disabled={pending}
              onClick={() => {
                if (roleDisabled) return;
                setEditing((value) => !value);
              }}
              className={roleDisabled ? "cursor-not-allowed opacity-50" : undefined}
            >
              {editing ? "Hide settings" : "Edit settings"}
            </Button>
          ) : null,
        )}
      </div>

      {!editable ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted">This rule type has no settings editor.</p>
          {hasConfig ? (
            <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-3 gap-y-1 text-xs">
              {Object.entries(rule.config).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-muted">{humanizeEvidenceKey(key)}</dt>
                  <dd className="font-mono text-text">
                    {formatEvidenceValue(key, value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}

      {error?.ruleId === rule.id ? (
        <InlineError
          error={error.error}
          copy={{ title: error.title, detail: error.detail }}
          onRetry={disabledReason ? undefined : (retryAction ?? (() => toggle(!rule.enabled)))}
        />
      ) : null}

      {editing && editable ? (
        <AlertRuleConfigForm
          key={rule.id}
          rule={rule}
          pending={pending}
          disabledReason={disabledReason}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      ) : null}
    </li>
  );
}

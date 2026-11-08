import { useState } from "react";
import type { AlertRule } from "../../../api/types";
import { formatEvidenceValue } from "../../../lib/evidence";
import { Button } from "../../../ui/Button";
import { Checkbox } from "../../../ui/Checkbox";
import { Input } from "../../../ui/Input";
import {
  ruleConfigPayload,
  ruleErrors,
  ruleFields,
  toRuleDraft,
  type RuleDraft,
} from "../lib/rules";

export interface AlertRuleConfigFormProps {
  rule: AlertRule;
  pending: boolean;
  disabledReason?: string;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function AlertRuleConfigForm({
  rule,
  pending,
  disabledReason,
  onSave,
  onCancel,
}: AlertRuleConfigFormProps) {
  const fields = ruleFields(rule.config);
  const [draft, setDraft] = useState<RuleDraft>(() => toRuleDraft(rule.config));
  const [submitted, setSubmitted] = useState(false);
  const errors = ruleErrors(rule.config, draft);
  const disabled = Boolean(disabledReason);

  if (fields.length === 0) {
    return <p className="text-xs text-muted">No settings.</p>;
  }

  function update(key: string, value: string | boolean): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="flex flex-col gap-3 border-t border-border pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(errors).length > 0) return;
        onSave(ruleConfigPayload(rule.config, draft));
      }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fields.map((field) => {
          if (field.type === "boolean") {
            return (
              <Checkbox
                key={field.key}
                label={field.label}
                checked={draft[field.key] === true}
                disabled={disabled || pending}
                onChange={(event) => update(field.key, event.target.checked)}
              />
            );
          }
          if (field.type === "number" || field.type === "string") {
            return (
              <Input
                key={field.key}
                name={`rule-${rule.id}-${field.key}`}
                label={field.label}
                type={field.type === "number" ? "number" : "text"}
                value={String(draft[field.key] ?? "")}
                disabled={disabled || pending}
                error={submitted ? errors[field.key] : undefined}
                onChange={(event) => update(field.key, event.target.value)}
              />
            );
          }
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <span className="text-sm font-medium text-text">{field.label}</span>
              <span className="font-mono text-xs text-muted">
                {formatEvidenceValue(field.key, field.value)}
              </span>
            </div>
          );
        })}
      </div>

      {disabled && disabledReason ? (
        <p className="text-xs text-muted">{disabledReason}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button size="sm" type="submit" loading={pending} disabled={disabled}>
          Save settings
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setDraft(toRuleDraft(rule.config));
            setSubmitted(false);
            onCancel();
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

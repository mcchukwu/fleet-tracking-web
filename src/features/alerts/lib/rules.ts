import { humanizeEvidenceKey } from "../../../lib/evidence";

export type RuleFieldType = "number" | "boolean" | "string" | "readonly";

export interface RuleField {
  key: string;
  label: string;
  type: RuleFieldType;
  value: unknown;
}

export type RuleDraft = Record<string, string | boolean>;

function fieldType(value: unknown): RuleFieldType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  return "readonly";
}

/** Nested objects, arrays and null are not editable; the full object is still sent. */
export function ruleFields(config: Record<string, unknown>): RuleField[] {
  return Object.entries(config).map(([key, value]) => ({
    key,
    label: humanizeEvidenceKey(key),
    type: fieldType(value),
    value,
  }));
}

export function toRuleDraft(config: Record<string, unknown>): RuleDraft {
  const draft: RuleDraft = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "number") draft[key] = String(value);
    else if (typeof value === "boolean") draft[key] = value;
    else if (typeof value === "string") draft[key] = value;
  }
  return draft;
}

export function ruleErrors(
  config: Record<string, unknown>,
  draft: RuleDraft,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ruleFields(config)) {
    const value = draft[field.key];
    if (field.type === "number") {
      const number = Number(value);
      if (value === "" || !Number.isFinite(number) || number < 0) {
        errors[field.key] = "Enter a number of 0 or more.";
      }
    }
    if (field.type === "string" && (typeof value !== "string" || value.trim() === "")) {
      errors[field.key] = "Enter a value.";
    }
  }
  return errors;
}

/** The server replaces the whole config, so every original key must be sent. */
export function ruleConfigPayload(
  config: Record<string, unknown>,
  draft: RuleDraft,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "number") {
      const number = Number(draft[key]);
      payload[key] = Number.isFinite(number) ? number : value;
    } else if (typeof value === "boolean") {
      payload[key] = typeof draft[key] === "boolean" ? draft[key] : value;
    } else if (typeof value === "string") {
      payload[key] = typeof draft[key] === "string" ? draft[key].trim() : value;
    } else {
      payload[key] = value;
    }
  }
  return payload;
}

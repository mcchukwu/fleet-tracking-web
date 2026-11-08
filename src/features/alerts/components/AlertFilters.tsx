import { RotateCcw } from "lucide-react";
import type { AlertSeverity, AlertStatus } from "../../../api/types";
import {
  alertStatusLabels,
  alertStatusOptions,
  severityLabels,
  severityOptions,
} from "../../../lib/status";
import { Button } from "../../../ui/Button";
import { SearchInput } from "../../../ui/SearchInput";
import { Select } from "../../../ui/Select";
import { cn } from "../../../ui/cn";
import type { AlertFilterValues } from "../lib/filter";

export interface AlertFilterOption {
  value: string;
  label: string;
}

export interface AlertFiltersProps {
  values: AlertFilterValues;
  typeOptions: readonly AlertFilterOption[];
  onChange: (patch: Partial<AlertFilterValues>) => void;
  onReset: () => void;
  disabled?: boolean;
  className?: string;
}

export function AlertFilters({
  values,
  typeOptions,
  onChange,
  onReset,
  disabled = false,
  className,
}: AlertFiltersProps) {
  const hasFilters =
    values.status !== null ||
    values.type !== null ||
    values.severity !== null ||
    values.q.trim() !== "";

  return (
    <div className={cn("flex flex-col gap-2 py-3", className)}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Select
          label="Status"
          value={values.status ?? ""}
          disabled={disabled}
          onChange={(event) =>
            onChange({ status: (event.target.value as AlertStatus) || null })
          }
        >
          <option value="">All statuses</option>
          {alertStatusOptions.map((status) => (
            <option key={status} value={status}>
              {alertStatusLabels[status]}
            </option>
          ))}
        </Select>

        <Select
          label="Type"
          value={values.type ?? ""}
          disabled={disabled}
          onChange={(event) => onChange({ type: event.target.value || null })}
        >
          <option value="">All types</option>
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          label="Severity"
          value={values.severity ?? ""}
          disabled={disabled}
          onChange={(event) =>
            onChange({ severity: (event.target.value as AlertSeverity) || null })
          }
        >
          <option value="">All severities</option>
          {severityOptions.map((severity) => (
            <option key={severity} value={severity}>
              {severityLabels[severity]}
            </option>
          ))}
        </Select>

        <div className="col-span-2 lg:col-span-1">
          <SearchInput
            label="Search plate"
            placeholder="Plate"
            value={values.q}
            onChange={(q) => onChange({ q })}
          />
        </div>

        <div className="col-span-2 flex items-end lg:col-span-1 lg:justify-end">
          <Button
            size="sm"
            variant="ghost"
            disabled={!hasFilters}
            leadingIcon={
              <RotateCcw aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />
            }
            onClick={onReset}
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

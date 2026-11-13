import { RotateCcw } from "lucide-react";
import { Button } from "../../../ui/Button";
import { SearchInput } from "../../../ui/SearchInput";
import { Select } from "../../../ui/Select";
import { cn } from "../../../ui/cn";
import type { AuditActionOption, AuditFilterValues } from "../lib/audit";

export interface AuditFiltersProps {
  values: AuditFilterValues;
  actionOptions: AuditActionOption[];
  onChange: (patch: Partial<AuditFilterValues>) => void;
  onReset: () => void;
  className?: string;
}

export function AuditFilters({
  values,
  actionOptions,
  onChange,
  onReset,
  className,
}: AuditFiltersProps) {
  const hasFilters = values.action !== null || values.q.trim() !== "";

  return (
    <div className={cn("grid grid-cols-2 gap-2 py-3 sm:grid-cols-4", className)}>
      <Select
        label="Action"
        value={values.action ?? ""}
        onChange={(event) =>
          onChange({ action: event.target.value === "" ? null : event.target.value })
        }
      >
        <option value="">All actions</option>
        {actionOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <div className="col-span-2">
        <SearchInput
          label="Search audit log"
          placeholder="Actor, action or entity"
          name="audit-search"
          shortcutHint={false}
          value={values.q}
          onChange={(q) => onChange({ q })}
        />
      </div>

      <div className="col-span-2 flex items-end justify-end sm:col-span-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={!hasFilters}
          leadingIcon={<RotateCcw aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />}
          onClick={onReset}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

import { RotateCcw } from "lucide-react";
import { driverStatusLabels, driverStatusOptions, isDriverStatus, type DriverStatus } from "../../../lib/drivers";
import { Button } from "../../../ui/Button";
import { SearchInput } from "../../../ui/SearchInput";
import { Select } from "../../../ui/Select";
import { cn } from "../../../ui/cn";

export interface DriverFilterValues {
  status: DriverStatus | null;
  q: string;
}

export interface DriverFiltersProps {
  values: DriverFilterValues;
  onChange: (patch: Partial<DriverFilterValues>) => void;
  onReset: () => void;
  className?: string;
}

export function DriverFilters({ values, onChange, onReset, className }: DriverFiltersProps) {
  const hasFilters = values.status !== null || values.q.trim() !== "";

  return (
    <div className={cn("flex flex-col gap-2 py-3", className)}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <Select
          label="Status"
          value={values.status ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            onChange({ status: isDriverStatus(value) ? value : null });
          }}
        >
          <option value="">All statuses</option>
          {driverStatusOptions.map((status) => (
            <option key={status} value={status}>
              {driverStatusLabels[status]}
            </option>
          ))}
        </Select>

        <div className="col-span-2 lg:col-span-1">
          <SearchInput
            name="driver-search"
            label="Search drivers"
            placeholder="Name, phone or licence"
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

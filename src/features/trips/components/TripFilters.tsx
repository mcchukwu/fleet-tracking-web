import { RotateCcw } from "lucide-react";
import type { TripStatus } from "../../../api/types";
import {
  isTripStatus,
  tripStatusLabels,
  tripStatusOptions,
} from "../../../lib/status";
import { isTripSort, tripSortOptions, type TripSort } from "../../../lib/trips";
import { Button } from "../../../ui/Button";
import { SearchInput } from "../../../ui/SearchInput";
import { Select } from "../../../ui/Select";
import { cn } from "../../../ui/cn";

export interface TripFilterValues {
  status: TripStatus | null;
  q: string;
  sort: TripSort;
}

const sortLabels: Record<TripSort, string> = {
  status: "Status",
  started: "Started",
  plate: "Plate",
};

export interface TripFiltersProps {
  values: TripFilterValues;
  onChange: (patch: Partial<TripFilterValues>) => void;
  onReset: () => void;
  className?: string;
}

export function TripFilters({ values, onChange, onReset, className }: TripFiltersProps) {
  const hasFilters = values.status !== null || values.q.trim() !== "";

  return (
    <div className={cn("flex flex-col gap-2 py-3", className)}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Select
          label="Status"
          value={values.status ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            onChange({ status: isTripStatus(value) ? value : null });
          }}
        >
          <option value="">All statuses</option>
          {tripStatusOptions.map((status) => (
            <option key={status} value={status}>
              {tripStatusLabels[status]}
            </option>
          ))}
        </Select>

        <Select
          label="Sort"
          value={values.sort}
          onChange={(event) => {
            const value = event.target.value;
            onChange({ sort: isTripSort(value) ? value : "status" });
          }}
        >
          {tripSortOptions.map((sort) => (
            <option key={sort} value={sort}>
              {sortLabels[sort]}
            </option>
          ))}
        </Select>

        <div className="col-span-2 lg:col-span-1">
          <SearchInput
            label="Search trips"
            placeholder="Plate, driver or route"
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

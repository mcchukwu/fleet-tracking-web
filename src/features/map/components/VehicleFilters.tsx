import { RotateCcw } from "lucide-react";
import type { VehicleDisplayStatus } from "../../../lib/status";
import { StatusPill } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { Checkbox } from "../../../ui/Checkbox";
import { SearchInput } from "../../../ui/SearchInput";
import { Select } from "../../../ui/Select";
import { cn } from "../../../ui/cn";
import type { MapFilterValues, MapSort } from "../lib/filter";

const statuses: readonly VehicleDisplayStatus[] = ["moving", "idle", "offline", "alert"];

const sortLabels: Record<MapSort, string> = {
  plate: "Plate",
  lastSeen: "Last seen",
  status: "Status",
};

export interface VehicleFiltersProps {
  values: MapFilterValues;
  depots: readonly string[];
  onChange: (patch: Partial<MapFilterValues>) => void;
  onReset: () => void;
  className?: string;
}

export function VehicleFilters({ values, depots, onChange, onReset, className }: VehicleFiltersProps) {
  const hasFilters =
    values.q !== "" ||
    values.statuses.length > 0 ||
    values.depot !== null ||
    values.onlyInView;

  function toggleStatus(status: VehicleDisplayStatus): void {
    onChange({
      statuses: values.statuses.includes(status)
        ? values.statuses.filter((item) => item !== status)
        : [...values.statuses, status],
    });
  }

  return (
    <div className={cn("flex flex-col gap-3 border-b border-border p-3", className)}>
      <SearchInput value={values.q} onChange={(q) => onChange({ q })} />

      <fieldset className="flex flex-wrap gap-1">
        <legend className="sr-only">Filter by status</legend>
        {statuses.map((status) => {
          const active = values.statuses.includes(status);
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => toggleStatus(status)}
              className={cn(
                "h-touch rounded-full border px-1.5 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring md:h-control-sm",
                active ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-2",
              )}
            >
              <StatusPill status={status} />
            </button>
          );
        })}
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <Select
          label="Depot"
          value={values.depot ?? ""}
          onChange={(event) => onChange({ depot: event.target.value || null })}
        >
          <option value="">All depots</option>
          {depots.map((depot) => (
            <option key={depot} value={depot}>
              {depot}
            </option>
          ))}
        </Select>
        <Select
          label="Sort"
          value={values.sort}
          onChange={(event) => onChange({ sort: event.target.value as MapSort })}
        >
          {Object.entries(sortLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Checkbox
          label="Only in view"
          checked={values.onlyInView}
          onChange={(event) => onChange({ onlyInView: event.target.checked })}
        />
        {hasFilters ? (
          <Button size="sm" variant="ghost" leadingIcon={<RotateCcw aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />} onClick={onReset}>
            Reset
          </Button>
        ) : null}
      </div>
    </div>
  );
}

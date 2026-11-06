import { Check, SlidersHorizontal } from "lucide-react";
import type { VehicleDisplayStatus } from "../../../lib/status";
import { StatusPill } from "../../../ui/Badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../ui/DropdownMenu";
import { DropdownMenuItem } from "../../../ui/DropdownMenu";
import { IconButton } from "../../../ui/IconButton";
import type { MapFilterValues, MapSort } from "../lib/filter";

const statuses: readonly VehicleDisplayStatus[] = ["moving", "idle", "offline", "alert"];

const sortLabels: Record<MapSort, string> = {
  plate: "Plate",
  lastSeen: "Last seen",
  status: "Status",
};

export interface MobileFilterMenuProps {
  filters: MapFilterValues;
  depots: readonly string[];
  onChange: (patch: Partial<MapFilterValues>) => void;
  onReset: () => void;
}

export function MobileFilterMenu({
  filters,
  depots,
  onChange,
  onReset,
}: MobileFilterMenuProps) {
  const activeCount =
    filters.statuses.length +
    (filters.depot ? 1 : 0) +
    (filters.onlyInView ? 1 : 0) +
    (filters.sort !== "plate" ? 1 : 0);
  const hasFilters = activeCount > 0 || filters.q !== "";

  function toggleStatus(status: VehicleDisplayStatus): void {
    onChange({
      statuses: filters.statuses.includes(status)
        ? filters.statuses.filter((item) => item !== status)
        : [...filters.statuses, status],
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          size="sm"
          label={activeCount > 0 ? `Filters (${activeCount})` : "Filters"}
          icon={<SlidersHorizontal aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        {statuses.map((status) => {
          const active = filters.statuses.includes(status);
          return (
            <DropdownMenuCheckboxItem
              key={status}
              checked={active}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => toggleStatus(status)}
            >
              <span className="flex-1">
                <StatusPill status={status} />
              </span>
              {active ? <Check aria-hidden="true" className="size-4" strokeWidth={2} /> : null}
            </DropdownMenuCheckboxItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Depot</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.depot ?? "all"}
          onValueChange={(value) => onChange({ depot: value === "all" ? null : value })}
        >
          <DropdownMenuRadioItem value="all">All depots</DropdownMenuRadioItem>
          {depots.map((depot) => (
            <DropdownMenuRadioItem key={depot} value={depot}>
              {depot}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Sort</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.sort}
          onValueChange={(value) => onChange({ sort: value as MapSort })}
        >
          {Object.entries(sortLabels).map(([value, label]) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={filters.onlyInView}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={(checked) => onChange({ onlyInView: checked === true })}
        >
          Only in view
        </DropdownMenuCheckboxItem>

        {hasFilters ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onReset}>Reset filters</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

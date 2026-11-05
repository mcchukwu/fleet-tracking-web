import { PanelLeftClose } from "lucide-react";
import type { AppError } from "../../../errors/types";
import { SlowNotice } from "../../../errors/SlowNotice";
import { Button } from "../../../ui/Button";
import { IconButton } from "../../../ui/IconButton";
import { EmptyState } from "../../../ui/StatePanel";
import { StateBoundary, type StateBoundaryState } from "../../../ui/StateBoundary";
import { cn } from "../../../ui/cn";
import type { MapFilterValues, VehicleRow } from "../lib/filter";
import { VehicleFilters } from "./VehicleFilters";
import { VehicleList } from "./VehicleList";
import { VehicleListSkeleton } from "./VehicleListSkeleton";

export interface VehiclePanelProps {
  rows: readonly VehicleRow[];
  total: number;
  positioned: number;
  filters: MapFilterValues;
  depots: readonly string[];
  loading: boolean;
  fetching?: boolean;
  error?: AppError | null;
  stale: boolean;
  staleLabel: string;
  selectedKey: string | null;
  rowHeight: number;
  signature: string;
  showHeader?: boolean;
  className?: string;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
  onFilterChange: (patch: Partial<MapFilterValues>) => void;
  onReset: () => void;
  onRetry: () => void;
  onCancelLoading?: () => void;
  onClose?: () => void;
}

export function VehiclePanel({
  rows,
  total,
  positioned,
  filters,
  depots,
  loading,
  fetching = false,
  error = null,
  stale,
  staleLabel,
  selectedKey,
  rowHeight,
  signature,
  showHeader = true,
  className,
  onSelect,
  onHover,
  onFilterChange,
  onReset,
  onRetry,
  onCancelLoading,
  onClose,
}: VehiclePanelProps) {
  const forbidden = error?.kind === "forbidden";
  const hasData = total > 0;
  const noPositions = total > 0 && positioned === 0;

  const state: StateBoundaryState = forbidden
    ? "forbidden"
    : loading && !hasData
      ? "loading"
      : error
        ? "error"
        : noPositions || rows.length === 0
          ? "empty"
          : stale
            ? "stale"
            : "ready";

  const emptyNode = noPositions ? (
    <EmptyState
      title="No vehicles are reporting a position"
      description="They appear on the map after a device sends its first position."
    />
  ) : total === 0 ? (
    <EmptyState
      title="No vehicles yet"
      description="They appear here after a device reports its first position."
    />
  ) : (
    <EmptyState
      title={
        filters.q
          ? `No vehicles match "${filters.q}"`
          : "No vehicles match these filters"
      }
      description={
        filters.q
          ? `Clear the filter to see all ${total}.`
          : `Reset the filters to see all ${total}.`
      }
      action={
        <Button size="sm" variant="secondary" onClick={onReset}>
          Clear filters
        </Button>
      }
    />
  );

  return (
    <section
      aria-label={showHeader ? "Vehicles" : "Vehicle list"}
      className={cn("flex min-h-0 flex-col bg-surface", className)}
    >
      {showHeader ? (
        <div className="flex min-h-touch items-center gap-2 border-b border-border px-3">
          <h2 className="text-md font-medium text-text">Vehicles</h2>
          <span className="text-xs tabular-nums text-muted">
            Showing {rows.length} of {total}
          </span>
          {onClose ? (
            <IconButton
              className="ml-auto"
              label="Hide the vehicle panel"
              size="sm"
              onClick={onClose}
              icon={<PanelLeftClose aria-hidden="true" className="size-4" strokeWidth={1.5} />}
            />
          ) : null}
        </div>
      ) : null}

      <VehicleFilters
        values={filters}
        depots={depots}
        onChange={onFilterChange}
        onReset={onReset}
      />

      {loading || fetching ? (
        <SlowNotice
          onRetry={onRetry}
          {...(onCancelLoading ? { onCancel: onCancelLoading } : {})}
        />
      ) : null}

      <StateBoundary
        state={state}
        error={error ?? undefined}
        onRetry={onRetry}
        loading={<VehicleListSkeleton rowHeight={rowHeight} />}
        empty={emptyNode}
        staleLabel={staleLabel}
        className="flex min-h-0 flex-1 flex-col"
      >
        {hasData && !forbidden && rows.length > 0 ? (
          <VehicleList
            rows={rows}
            selectedKey={selectedKey}
            rowHeight={rowHeight}
            signature={signature}
            onSelect={onSelect}
            onHover={onHover}
          />
        ) : undefined}
      </StateBoundary>
    </section>
  );
}

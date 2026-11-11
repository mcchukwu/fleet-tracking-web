import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Driver } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import { SlowNotice } from "../../../errors/SlowNotice";
import { MISSING, formatCount } from "../../../lib/format";
import { driverDescription, isDriverStatus } from "../../../lib/drivers";
import { isDialablePhone } from "../lib/form";
import { Button } from "../../../ui/Button";
import { CopyButton } from "../../../ui/CopyButton";
import {
  DataTable,
  type DataTableColumn,
} from "../../../ui/DataTable";
import { EmptyState, Skeleton } from "../../../ui/StatePanel";
import { StateBoundary, type StateBoundaryState } from "../../../ui/StateBoundary";
import { cn } from "../../../ui/cn";
import { DriverStatusBadge } from "./DriverStatusBadge";

const COLUMN_WIDTHS = {
  name: 200,
  phone: 170,
  licence: 160,
  status: 120,
  vehicles: 110,
} as const;

const COLUMN_ORDER = [
  ["name", "Name"],
  ["phone", "Phone"],
  ["licence", "Licence"],
  ["status", "Status"],
  ["vehicles", "Vehicles"],
] as const;

const SKELETON_COLUMNS: DataTableColumn<{ id: string }>[] = COLUMN_ORDER.map(
  ([id, label]) => ({
    id,
    header: label,
    width: COLUMN_WIDTHS[id],
    align: "left",
    cell: () => <Skeleton className="h-3 w-full max-w-24" />,
  }),
);

export type DriverEmptyReason = "no-data" | "no-results";

function scrollToTop(element: HTMLElement): void {
  if (typeof element.scrollTo === "function") {
    element.scrollTo({ top: 0, behavior: "auto" });
    return;
  }
  element.scrollTop = 0;
}

function phoneHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, "")}`;
}

function DriverTableSkeleton() {
  const rows = Array.from({ length: 6 }, (_, index) => ({ id: `skeleton-${index}` }));
  return (
    <output aria-busy="true" aria-label="Loading drivers" className="block">
      <DataTable
        label="Loading drivers"
        columns={SKELETON_COLUMNS}
        rows={rows}
        rowKey={(row) => row.id}
      />
    </output>
  );
}

interface DriverOpenButtonProps {
  driver: Driver;
  onOpen: () => void;
}

function DriverOpenButton({ driver, onOpen }: DriverOpenButtonProps) {
  const description = driverDescription(driver);
  return (
    <button
      type="button"
      data-driver-id={driver.id}
      aria-label={`Open driver ${driver.name}, ${description || "no contact details"}`}
      title={driver.name}
      onClick={onOpen}
      className="focus-visible:outline-focus-ring -my-2 inline-flex h-touch max-w-full items-center truncate rounded-sm text-left text-sm text-text underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-0 md:my-0 md:h-auto"
    >
      {driver.name}
    </button>
  );
}

export interface DriverTableProps {
  drivers: Driver[];
  state: StateBoundaryState;
  error?: AppError | null;
  onRetry: () => void;
  onCancelLoading: () => void;
  onOpen: (id: string) => void;
  emptyReason: DriverEmptyReason | null;
  onClearFilters: () => void;
  hasDrivers: boolean;
  staleLabel?: string;
  forbiddenAction?: ReactNode;
  offline: boolean;
  cancelled: boolean;
  resetKey?: string;
}

export function DriverTable({
  drivers,
  state,
  error,
  onRetry,
  onCancelLoading,
  onOpen,
  emptyReason,
  onClearFilters,
  hasDrivers,
  staleLabel,
  forbiddenAction,
  offline,
  cancelled,
  resetKey,
}: DriverTableProps) {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (scroller) scrollToTop(scroller);
  }, [resetKey, scroller]);

  const columns = useMemo<DataTableColumn<Driver>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        width: COLUMN_WIDTHS.name,
        align: "left",
        title: (driver) => driver.name,
        cell: (driver) => <DriverOpenButton driver={driver} onOpen={() => onOpen(driver.id)} />,
      },
      {
        id: "phone",
        header: "Phone",
        width: COLUMN_WIDTHS.phone,
        align: "left",
        title: (driver) => (driver.phone ? driver.phone : MISSING),
        cell: (driver) =>
          isDialablePhone(driver.phone) ? (
            <a
              href={phoneHref(driver.phone)}
              className="focus-visible:outline-focus-ring -my-2 inline-flex h-touch items-center font-mono text-sm text-text underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-0 md:my-0 md:h-auto"
            >
              {driver.phone}
            </a>
          ) : (
            <span className="text-muted text-sm">{driver.phone || MISSING}</span>
          ),
      },
      {
        id: "licence",
        header: "Licence",
        width: COLUMN_WIDTHS.licence,
        align: "left",
        truncate: false,
        title: (driver) => (driver.licence ? driver.licence : MISSING),
        cell: (driver) =>
          driver.licence ? (
            <CopyButton inline value={driver.licence} label="licence" className="text-xs" />
          ) : (
            <span className="text-muted text-sm">{MISSING}</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        width: COLUMN_WIDTHS.status,
        align: "left",
        title: (driver) => (isDriverStatus(driver.status) ? null : driver.status),
        cell: (driver) => <DriverStatusBadge status={driver.status} />,
      },
      {
        id: "vehicles",
        header: "Vehicles",
        width: COLUMN_WIDTHS.vehicles,
        align: "right",
        title: (driver) => formatCount(driver.vehicles),
        cell: (driver) => (
          <span className="text-text text-sm tabular-nums">{formatCount(driver.vehicles)}</span>
        ),
      },
    ],
    [onOpen],
  );

  const empty = cancelled ? (
    <EmptyState
      title="Loading cancelled"
      description="The driver list request was cancelled."
      action={
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      }
    />
  ) : offline && !hasDrivers ? (
    <EmptyState
      title="No drivers available offline"
      description="Reconnect to load the driver list."
    />
  ) : emptyReason === "no-results" ? (
    <EmptyState
      title="No drivers match"
      description="Try a different search or clear the filters."
      action={
        <Button size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState title="No drivers yet" description="Create the first one." />
  );

  return (
    <StateBoundary
      state={state}
      error={error}
      onRetry={onRetry}
      loading={
        <div>
          <SlowNotice onRetry={onRetry} onCancel={onCancelLoading} />
          <DriverTableSkeleton />
        </div>
      }
      empty={empty}
      staleLabel={staleLabel}
      forbiddenAction={forbiddenAction}
      className="flex min-h-0 flex-1 flex-col"
    >
      {state === "error" && drivers.length === 0 ? null : (
        <div className={cn("flex min-h-0 flex-1 flex-col", (offline || state === "error") && "opacity-80")}>
          <DataTable
            label="Drivers"
            columns={columns}
            rows={drivers}
            rowKey={(driver) => driver.id}
            className="min-h-0 flex-1"
            onScrollerChange={setScroller}
            rowProps={(driver) => ({
              "data-driver-row": driver.id,
              className: "cursor-pointer",
              onClick: (event) => {
                if ((event.target as HTMLElement).closest("button, a")) return;
                onOpen(driver.id);
              },
            })}
          />
        </div>
      )}
    </StateBoundary>
  );
}

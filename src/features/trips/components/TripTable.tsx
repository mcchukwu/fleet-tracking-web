import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Copy } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Trip } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import { InlineError } from "../../../errors/InlineError";
import { SlowNotice } from "../../../errors/SlowNotice";
import { MISSING, formatDistance } from "../../../lib/format";
import { isTripStatus } from "../../../lib/status";
import {
  tripDistanceKm,
  type TripAction,
  type TripEmptyReason,
} from "../../../lib/trips";
import { Badge, TripStatusBadge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { CopyButton } from "../../../ui/CopyButton";
import {
  DataTable,
  DATA_TABLE_ROW_HEIGHT,
  type DataTableColumn,
} from "../../../ui/DataTable";
import { EmptyState, Skeleton } from "../../../ui/StatePanel";
import { StateBoundary, type StateBoundaryState } from "../../../ui/StateBoundary";
import { Timestamp } from "../../../ui/Timestamp";
import { cn } from "../../../ui/cn";
import { TripRowActions } from "./TripRowActions";

const COLUMN_WIDTHS = {
  vehicle: 150,
  driver: 150,
  origin: 170,
  destination: 170,
  status: 110,
  started: 120,
  ended: 120,
  distance: 100,
  actions: 220,
} as const;

const COLUMN_ORDER = [
  ["vehicle", "Vehicle"],
  ["driver", "Driver"],
  ["origin", "Origin"],
  ["destination", "Destination"],
  ["status", "Status"],
  ["started", "Started"],
  ["ended", "Ended"],
  ["distance", "Distance"],
  ["actions", ""],
] as const;

const TABLE_MIN_WIDTH = COLUMN_ORDER.reduce(
  (total, [id]) => total + COLUMN_WIDTHS[id],
  0,
);

function cellWidth(width: number): CSSProperties {
  return { width };
}

function tableMinWidth(width: number): CSSProperties {
  return { minWidth: width };
}

function scrollToTop(element: HTMLElement): void {
  if (typeof element.scrollTo === "function") {
    element.scrollTo({ top: 0, behavior: "auto" });
    return;
  }
  element.scrollTop = 0;
}

export interface TripActionError {
  tripId: string;
  error: AppError;
  title: string;
  detail: string;
  onRetry?: () => void;
}

type DisplayRow =
  | { kind: "trip"; trip: Trip; virtualIndex?: number }
  | {
      kind: "action-error";
      trip: Trip;
      actionError: TripActionError;
      virtualIndex?: number;
    };

interface TripOpenButtonProps {
  trip: Trip;
  onOpen: () => void;
}

function TripOpenButton({ trip, onOpen }: TripOpenButtonProps) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <button
        type="button"
        data-trip-id={trip.id}
        aria-label={`Open trip to ${trip.destination} for ${trip.plate}`}
        title={trip.plate}
        onClick={onOpen}
        className="focus-visible:outline-focus-ring -my-2 min-w-0 truncate rounded-sm font-mono text-sm text-text underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-0 md:my-0"
      >
        {trip.plate}
      </button>
      <CopyButton
        value={trip.plate}
        label="plate"
        className="-my-2 shrink-0 px-1 md:my-0"
      >
        <Copy aria-hidden="true" className="size-3" strokeWidth={1.5} />
      </CopyButton>
    </span>
  );
}

function TripTableSkeleton() {
  return (
    <output aria-busy="true" aria-label="Loading trips" className="block">
      <div className="border-border overflow-x-auto rounded-lg border">
        <table
          className="w-full table-fixed border-collapse text-sm"
          style={tableMinWidth(TABLE_MIN_WIDTH)}
        >
          <thead className="bg-surface-2">
            <tr className="h-row border-border border-b">
              {COLUMN_ORDER.map(([id, label], index) => (
                <th
                  key={id}
                  scope="col"
                  className={cn(
                    "label-caps text-muted px-3 py-0 text-left",
                    id === "actions" && "text-right",
                  )}
                  style={cellWidth(COLUMN_WIDTHS[id])}
                >
                  {index === COLUMN_ORDER.length - 1 ? (
                    <span className="sr-only">Actions</span>
                  ) : (
                    label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, rowIndex) => (
              <tr key={rowIndex} className="h-row border-border border-b last:border-0">
                {COLUMN_ORDER.map(([id]) => (
                  <td key={id} className="px-3 py-0">
                    <Skeleton className="h-3 w-full max-w-24" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </output>
  );
}

export interface TripTableProps {
  trips: Trip[];
  state: StateBoundaryState;
  error?: AppError | null;
  onRetry: () => void;
  onCancelLoading?: () => void;
  onOpen: (id: string) => void;
  onAction: (trip: Trip, action: TripAction) => void;
  pendingId: string | null;
  disabledReason?: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  emptyReason: TripEmptyReason | null;
  onClearFilters: () => void;
  actionError?: TripActionError | null;
  staleLabel?: string;
  forbiddenAction?: ReactNode;
  resetKey?: string;
  offline?: boolean;
}

export function TripTable({
  trips,
  state,
  error,
  onRetry,
  onCancelLoading,
  onOpen,
  onAction,
  pendingId,
  disabledReason,
  hasMore,
  loadingMore,
  onLoadMore,
  emptyReason,
  onClearFilters,
  actionError = null,
  staleLabel,
  forbiddenAction,
  resetKey,
  offline = false,
}: TripTableProps) {
  "use no memo";
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scroller) scrollToTop(scroller);
  }, [resetKey, scroller]);

  const displayRows = useMemo<DisplayRow[]>(() => {
    const rows: DisplayRow[] = [];
    for (const trip of trips) {
      rows.push({ kind: "trip", trip });
      if (actionError?.tripId === trip.id) {
        rows.push({ kind: "action-error", trip, actionError });
      }
    }
    return rows;
  }, [trips, actionError]);

  // oxlint-disable-next-line react/incompatible-library -- TanStack Virtual returns stable observers; this component does not memoize the handle.
  const virtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => scroller,
    estimateSize: () => DATA_TABLE_ROW_HEIGHT,
    overscan: 8,
    scrollMargin: DATA_TABLE_ROW_HEIGHT,
    getItemKey: (index) => {
      const row = displayRows[index];
      return row ? `${row.kind}:${row.trip.id}` : index;
    },
  });

  const virtualItems = scroller ? virtualizer.getVirtualItems() : [];
  const virtualRows: DisplayRow[] = [];
  if (scroller) {
    for (const item of virtualItems) {
      const row = displayRows[item.index];
      if (row) virtualRows.push({ ...row, virtualIndex: item.index });
    }
  }
  const rowsToRender =
    scroller && (virtualItems.length > 0 || displayRows.length === 0)
      ? virtualRows
      : displayRows;

  const paddingTop =
    virtualItems.length > 0
      ? Math.max(0, virtualItems[0].start - DATA_TABLE_ROW_HEIGHT)
      : 0;
  const lastItem = virtualItems[virtualItems.length - 1];
  const paddingBottom = lastItem
    ? Math.max(0, virtualizer.getTotalSize() - lastItem.end)
    : 0;

  const columns = useMemo<DataTableColumn<DisplayRow>[]>(
    () => [
      {
        id: "vehicle",
        header: "Vehicle",
        width: COLUMN_WIDTHS.vehicle,
        align: "left",
        truncate: false,
        cell: (row) => (
          <TripOpenButton trip={row.trip} onOpen={() => onOpen(row.trip.id)} />
        ),
      },
      {
        id: "driver",
        header: "Driver",
        width: COLUMN_WIDTHS.driver,
        align: "left",
        title: (row) => row.trip.driver_name ?? MISSING,
        cell: (row) => (
          <span className="text-text text-sm">{row.trip.driver_name ?? MISSING}</span>
        ),
      },
      {
        id: "origin",
        header: "Origin",
        width: COLUMN_WIDTHS.origin,
        align: "left",
        title: (row) => row.trip.origin,
        cell: (row) => <span className="text-text text-sm">{row.trip.origin}</span>,
      },
      {
        id: "destination",
        header: "Destination",
        width: COLUMN_WIDTHS.destination,
        align: "left",
        title: (row) => row.trip.destination,
        cell: (row) => (
          <span className="text-text text-sm">{row.trip.destination}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: COLUMN_WIDTHS.status,
        align: "left",
        truncate: false,
        cell: (row) =>
          isTripStatus(row.trip.status) ? (
            <TripStatusBadge status={row.trip.status} />
          ) : (
            <Badge tone="neutral">Unknown status: {row.trip.status}</Badge>
          ),
      },
      {
        id: "started",
        header: "Started",
        width: COLUMN_WIDTHS.started,
        align: "left",
        truncate: false,
        title: (row) => row.trip.started_at ?? MISSING,
        cell: (row) =>
          row.trip.started_at ? (
            <Timestamp iso={row.trip.started_at} className="text-xs text-muted" />
          ) : (
            <span className="text-muted text-xs">{MISSING}</span>
          ),
      },
      {
        id: "ended",
        header: "Ended",
        width: COLUMN_WIDTHS.ended,
        align: "left",
        truncate: false,
        title: (row) => row.trip.ended_at ?? MISSING,
        cell: (row) =>
          row.trip.ended_at ? (
            <Timestamp iso={row.trip.ended_at} className="text-xs text-muted" />
          ) : (
            <span className="text-muted text-xs">{MISSING}</span>
          ),
      },
      {
        id: "distance",
        header: "Distance",
        width: COLUMN_WIDTHS.distance,
        align: "right",
        title: (row) => {
          const distance = tripDistanceKm(row.trip);
          return distance === null ? MISSING : formatDistance(distance);
        },
        cell: (row) => (
          <span className="text-text text-sm tabular-nums">
            {formatDistance(tripDistanceKm(row.trip))}
          </span>
        ),
      },
      {
        id: "actions",
        header: <span className="sr-only">Actions</span>,
        width: COLUMN_WIDTHS.actions,
        align: "right",
        truncate: false,
        cell: (row) => (
          <TripRowActions
            trip={row.trip}
            pending={pendingId === row.trip.id}
            {...(disabledReason ? { disabledReason } : {})}
            onAction={(action) => onAction(row.trip, action)}
          />
        ),
      },
    ],
    [disabledReason, onAction, onOpen, pendingId],
  );

  const empty = offline ? (
    <EmptyState
      title="No trips available offline"
      description="Reconnect to load the trip list."
    />
  ) : emptyReason === "no-loaded-matches" ? (
    <EmptyState
      title="No trips match in the loaded trips"
      description="Load more to search older trips."
      action={
        <Button size="sm" onClick={onLoadMore} loading={loadingMore}>
          Load more
        </Button>
      }
    />
  ) : emptyReason === "no-results" ? (
    <EmptyState
      title="No trips match"
      description="Try a different search or clear the filters."
      action={
        <Button size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState title="No trips yet" description="Create the first one." />
  );

  return (
    <StateBoundary
      state={state}
      error={error}
      onRetry={onRetry}
      loading={
        <div>
          <SlowNotice onRetry={onRetry} onCancel={onCancelLoading} />
          <TripTableSkeleton />
        </div>
      }
      empty={empty}
      staleLabel={staleLabel}
      forbiddenAction={forbiddenAction}
      className="flex min-h-0 flex-1 flex-col"
    >
      {state === "error" && trips.length === 0 ? null : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <DataTable
              label="Trips"
              columns={columns}
              rows={rowsToRender}
              rowKey={(row, index) =>
                `${row.kind}:${row.trip.id}:${row.virtualIndex ?? index}`
              }
              className="min-h-0 flex-1"
              topSpacer={paddingTop}
              bottomSpacer={paddingBottom}
              onScrollerChange={setScroller}
              rowProps={(row) =>
                row.kind === "trip"
                  ? {
                      className: "cursor-pointer",
                      onClick: (event) => {
                        if ((event.target as HTMLElement).closest("button, a")) return;
                        onOpen(row.trip.id);
                      },
                    }
                  : {}
              }
              renderRow={(row, index, _cells) => {
                if (row.kind !== "action-error") return undefined;
                return (
                  <tr
                    key={`action-error:${row.trip.id}:${row.virtualIndex ?? index}`}
                    data-row="error"
                    data-index={row.virtualIndex}
                    ref={(element) => {
                      if (element) virtualizer.measureElement(element);
                    }}
                  >
                    <td
                      colSpan={columns.length}
                      className="border-border border-b px-3 py-2"
                    >
                      <InlineError
                        error={row.actionError.error}
                        copy={{
                          title: row.actionError.title,
                          detail: row.actionError.detail,
                        }}
                        {...(row.actionError.onRetry
                          ? { onRetry: row.actionError.onRetry }
                          : {})}
                      />
                    </td>
                  </tr>
                );
              }}
            />
          </div>

          {hasMore ? (
            <div className="flex shrink-0 justify-center py-3">
              <Button size="sm" onClick={onLoadMore} loading={loadingMore}>
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </StateBoundary>
  );
}

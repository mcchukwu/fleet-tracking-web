import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Alert } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import { InlineError } from "../../../errors/InlineError";
import { SlowNotice } from "../../../errors/SlowNotice";
import {
  alertStatusLabels,
  alertTypeLabel,
  isAlertSeverity,
  isAlertStatus,
  severityLabels,
} from "../../../lib/status";
import {
  MISSING,
  formatRelativeTime,
  formatTimeTooltip,
} from "../../../lib/format";
import { useNow } from "../../../lib/ticker";
import { Badge, AlertStatusBadge, SeverityBadge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { CopyButton } from "../../../ui/CopyButton";
import {
  DataTable,
  DATA_TABLE_ROW_HEIGHT,
  type DataTableColumn,
} from "../../../ui/DataTable";
import { EmptyState, Skeleton } from "../../../ui/StatePanel";
import {
  StateBoundary,
  type StateBoundaryState,
} from "../../../ui/StateBoundary";
import { cn } from "../../../ui/cn";
import type { AckErrorState } from "../hooks/useAlertAck";
import type { AlertEmptyReason } from "../lib/filter";
import { AlertAckButton } from "./AlertAckButton";
import { AlertNewPill } from "./AlertNewPill";

const COLUMN_WIDTHS = {
  time: 116,
  plate: 124,
  type: 150,
  severity: 116,
  status: 220,
  zone: 156,
  trip: 292,
  actions: 140,
} as const;

const COLUMN_ORDER = [
  ["time", "Time"],
  ["plate", "Plate"],
  ["type", "Type"],
  ["severity", "Severity"],
  ["status", "Status"],
  ["zone", "Zone"],
  ["trip", "Trip"],
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

type DisplayRow =
  | { kind: "alert"; alert: Alert; virtualIndex?: number }
  | {
      kind: "ack-error";
      alert: Alert;
      error: AckErrorState;
      virtualIndex?: number;
    };

interface AlertTimeCellProps {
  alert: Alert;
  onOpen: () => void;
  onAck: () => void;
  pending: boolean;
  disabledReason?: string;
}

function AlertTimeCell({
  alert,
  onOpen,
  onAck,
  pending,
  disabledReason,
}: AlertTimeCellProps) {
  const now = useNow();
  const relativeTime = formatRelativeTime(alert.occurred_at, now);
  const tooltip = formatTimeTooltip(alert.occurred_at);
  const canAck = isAlertStatus(alert.status) && alert.status === "open";

  return (
    <button
      type="button"
      data-alert-row
      data-alert-id={alert.id}
      aria-label={`Open alert for ${alert.plate}, ${relativeTime}, ${tooltip}`}
      title={tooltip}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== "a") return;
        event.preventDefault();
        if (!canAck || disabledReason || pending) return;
        onAck();
      }}
      className="h-touch text-muted hover:text-text focus-visible:outline-focus-ring min-w-touch -my-2 inline-flex items-center justify-start rounded-sm text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-offset-0 md:my-0 md:h-auto md:min-w-0"
    >
      <time dateTime={alert.occurred_at}>{relativeTime}</time>
    </button>
  );
}

function AlertStatusCell({ alert }: { alert: Alert }) {
  const now = useNow();
  const statusLabel = statusTitle(alert);

  return (
    <span
      className="inline-flex max-w-full flex-nowrap items-center gap-1 whitespace-nowrap"
      title={statusLabel}
    >
      <span className="min-w-0">
        {isAlertStatus(alert.status) ? (
          <AlertStatusBadge status={alert.status} />
        ) : (
          <Badge tone="neutral">Unknown status: {alert.status}</Badge>
        )}
      </span>
      {alert.acked_at ? (
        <span
          title={formatTimeTooltip(alert.acked_at)}
          className="text-muted min-w-0 truncate text-xs tabular-nums"
        >
          {formatRelativeTime(alert.acked_at, now)}
        </span>
      ) : null}
    </span>
  );
}

function statusTitle(alert: Alert): string {
  return isAlertStatus(alert.status)
    ? alertStatusLabels[alert.status]
    : `Unknown status: ${alert.status}`;
}

function severityTitle(alert: Alert): string {
  return isAlertSeverity(alert.severity)
    ? severityLabels[alert.severity]
    : `Unknown severity: ${alert.severity}`;
}

function AlertTableSkeleton() {
  return (
    <output aria-busy="true" aria-label="Loading alerts" className="block">
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
              <tr
                key={rowIndex}
                className="h-row border-border border-b last:border-0"
              >
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

export interface AlertTableProps {
  alerts: Alert[];
  state: StateBoundaryState;
  error?: AppError | null;
  onRetry: () => void;
  onCancelLoading?: () => void;
  onOpen: (id: string) => void;
  onAck: (alert: Alert) => void;
  pendingId: string | null;
  disabledReason?: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  newCount: number;
  onRevealNew: () => void;
  highlightIds: ReadonlySet<string>;
  emptyReason: AlertEmptyReason;
  onClearFilters: () => void;
  zoneFor: (alert: Alert) => string | null;
  tripFor: (alert: Alert) => string | null;
  onScrollTopChange: (atTop: boolean) => void;
  resetKey?: string;
  ackError?: AckErrorState | null;
  offline?: boolean;
  staleLabel?: string;
  forbiddenAction?: ReactNode;
}

export function AlertTable({
  alerts,
  state,
  error,
  onRetry,
  onCancelLoading,
  onOpen,
  onAck,
  pendingId,
  disabledReason,
  hasMore,
  loadingMore,
  onLoadMore,
  newCount,
  onRevealNew,
  highlightIds,
  emptyReason,
  onClearFilters,
  zoneFor,
  tripFor,
  onScrollTopChange,
  resetKey,
  ackError = null,
  offline = false,
  staleLabel,
  forbiddenAction,
}: AlertTableProps) {
  "use no memo";
  const [scroller, setScroller] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (scroller) scrollToTop(scroller);
  }, [resetKey, scroller]);

  const displayRows = useMemo<DisplayRow[]>(() => {
    const rows: DisplayRow[] = [];
    for (const alert of alerts) {
      rows.push({ kind: "alert", alert });
      if (ackError?.alertId === alert.id) {
        rows.push({ kind: "ack-error", alert, error: ackError });
      }
    }
    return rows;
  }, [alerts, ackError]);

  // oxlint-disable-next-line react/incompatible-library -- TanStack Virtual returns stable observers; this component does not memoize the handle.
  const virtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => scroller,
    estimateSize: () => DATA_TABLE_ROW_HEIGHT,
    overscan: 8,
    scrollMargin: DATA_TABLE_ROW_HEIGHT,
    getItemKey: (index) => {
      const row = displayRows[index];
      return row ? `${row.kind}:${row.alert.id}` : index;
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
        id: "time",
        header: "Time",
        width: COLUMN_WIDTHS.time,
        align: "left",
        cell: (row) => (
          <AlertTimeCell
            alert={row.alert}
            onOpen={() => onOpen(row.alert.id)}
            onAck={() => onAck(row.alert)}
            pending={pendingId === row.alert.id}
            {...(disabledReason ? { disabledReason } : {})}
          />
        ),
      },
      {
        id: "plate",
        header: "Plate",
        width: COLUMN_WIDTHS.plate,
        align: "left",
        truncate: false,
        title: (row) => row.alert.plate,
        cell: (row) => (
          <CopyButton
            inline
            value={row.alert.plate}
            label="plate"
            className="text-xs"
          />
        ),
      },
      {
        id: "type",
        header: "Type",
        width: COLUMN_WIDTHS.type,
        align: "left",
        title: (row) => alertTypeLabel(row.alert.type),
        cell: (row) => (
          <span className="text-text text-sm">
            {alertTypeLabel(row.alert.type)}
          </span>
        ),
      },
      {
        id: "severity",
        header: "Severity",
        width: COLUMN_WIDTHS.severity,
        align: "left",
        title: (row) => severityTitle(row.alert),
        cell: (row) =>
          isAlertSeverity(row.alert.severity) ? (
            <SeverityBadge level={row.alert.severity} />
          ) : (
            <Badge tone="neutral">Unknown severity: {row.alert.severity}</Badge>
          ),
      },
      {
        id: "status",
        header: "Status",
        width: COLUMN_WIDTHS.status,
        align: "left",
        title: (row) => statusTitle(row.alert),
        cell: (row) => <AlertStatusCell alert={row.alert} />,
      },
      {
        id: "zone",
        header: "Zone",
        width: COLUMN_WIDTHS.zone,
        align: "left",
        title: (row) => zoneFor(row.alert) ?? MISSING,
        cell: (row) => (
          <span className="text-muted text-xs">
            {zoneFor(row.alert) ?? MISSING}
          </span>
        ),
      },
      {
        id: "trip",
        header: "Trip",
        width: COLUMN_WIDTHS.trip,
        align: "left",
        truncate: false,
        title: (row) => tripFor(row.alert) ?? MISSING,
        cell: (row) => {
          const tripLabel = tripFor(row.alert);
          return tripLabel ? (
            <CopyButton
              inline
              value={tripLabel}
              label="trip id"
              className="text-xs"
            />
          ) : (
            <span className="text-muted text-xs">{MISSING}</span>
          );
        },
      },
      {
        id: "actions",
        header: <span className="sr-only">Actions</span>,
        width: COLUMN_WIDTHS.actions,
        align: "right",
        cell: (row) =>
          isAlertStatus(row.alert.status) && row.alert.status === "open" ? (
            <AlertAckButton
              alert={row.alert}
              pending={pendingId === row.alert.id}
              {...(disabledReason ? { disabledReason } : {})}
              onAck={() => onAck(row.alert)}
            />
          ) : null,
      },
    ],
    [disabledReason, onAck, onOpen, pendingId, tripFor, zoneFor],
  );

  const empty = offline ? (
    <EmptyState
      title="No alerts available offline"
      description="Reconnect to load the alert list."
    />
  ) : emptyReason === "no-loaded-matches" ? (
    <EmptyState
      title="No alerts match in the loaded alerts"
      description="Load more to search older alerts."
      action={
        <Button size="sm" onClick={onLoadMore} loading={loadingMore}>
          Load more
        </Button>
      }
    />
  ) : emptyReason === "no-results" ? (
    <EmptyState
      title="No alerts match"
      description="Try a different search or clear the filters."
      action={
        <Button size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      title="No alerts yet"
      description="Alerts appear here when a rule fires."
    />
  );

  function revealNew(): void {
    if (scroller) scrollToTop(scroller);
    onRevealNew();
  }

  return (
    <StateBoundary
      state={state}
      error={error}
      onRetry={onRetry}
      loading={
        <div>
          <SlowNotice onRetry={onRetry} onCancel={onCancelLoading} />
          <AlertTableSkeleton />
        </div>
      }
      empty={empty}
      staleLabel={staleLabel}
      forbiddenAction={forbiddenAction}
      className="flex min-h-0 flex-1 flex-col"
    >
      {state === "error" && alerts.length === 0 ? null : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <DataTable
              label="Alerts"
              columns={columns}
              rows={rowsToRender}
              rowKey={(row, index) =>
                `${row.kind}:${row.alert.id}:${row.virtualIndex ?? index}`
              }
              className="min-h-0 flex-1"
              topSpacer={paddingTop}
              bottomSpacer={paddingBottom}
              onScrollerChange={setScroller}
              onScroll={(event) =>
                onScrollTopChange(event.currentTarget.scrollTop <= 8)
              }
              rowProps={(row) =>
                row.kind === "alert"
                  ? {
                      className: cn(
                        "group cursor-pointer",
                        highlightIds.has(row.alert.id) &&
                          "value-flash bg-accent-soft",
                      ),
                      onClick: (event) => {
                        if ((event.target as HTMLElement).closest("button, a"))
                          return;
                        onOpen(row.alert.id);
                      },
                    }
                  : {}
              }
              renderRow={(row, index, _cells) => {
                if (row.kind !== "ack-error") return undefined;
                return (
                  <tr
                    key={`ack-error:${row.alert.id}:${row.virtualIndex ?? index}`}
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
                        error={row.error.error}
                        copy={{
                          title: row.error.title,
                          detail: row.error.detail,
                        }}
                        onRetry={() => onAck(row.alert)}
                      />
                    </td>
                  </tr>
                );
              }}
            />

            <AlertNewPill count={newCount} onReveal={revealNew} />
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

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Alert } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import { InlineError } from "../../../errors/InlineError";
import { SlowNotice } from "../../../errors/SlowNotice";
import { Button } from "../../../ui/Button";
import { EmptyState, Skeleton } from "../../../ui/StatePanel";
import { StateBoundary, type StateBoundaryState } from "../../../ui/StateBoundary";
import { Table, TBody, TH, THead, TR } from "../../../ui/Table";
import type { AckErrorState } from "../hooks/useAlertAck";
import type { AlertEmptyReason } from "../lib/filter";
import { AlertNewPill } from "./AlertNewPill";
import { AlertRow } from "./AlertRow";

const COLUMNS = ["Time", "Plate", "Type", "Severity", "Status", "Zone", "Trip", ""] as const;

type DisplayRow =
  | { kind: "alert"; alert: Alert }
  | { kind: "ack-error"; alert: Alert; error: AckErrorState };

function spacerStyle(height: number): CSSProperties {
  return { height };
}

function SpacerRow({ height }: { height: number }) {
  return (
    <tr aria-hidden="true">
      <td
        aria-hidden="true"
        colSpan={COLUMNS.length}
        className="p-0"
        style={spacerStyle(height)}
      />
    </tr>
  );
}

function AlertTableSkeleton() {
  return (
    <output aria-busy="true" aria-label="Loading alerts" className="block">
      <Table>
        <THead>
          <TR>
            {COLUMNS.map((column, index) => (
              <TH key={`${column}-${index}`} className={index === 7 ? "text-right" : undefined}>
                {column || <span className="sr-only">Actions</span>}
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {Array.from({ length: 6 }).map((_, index) => (
            <TR key={index}>
              {COLUMNS.map((column, columnIndex) => (
                <td key={`${column}-${columnIndex}`} className="px-3">
                  <Skeleton className="h-3 w-full max-w-24" />
                </td>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
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
  ackError = null,
  offline = false,
  staleLabel,
  forbiddenAction,
}: AlertTableProps) {
  "use no memo";
  const rootRef = useRef<HTMLDivElement>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    setScroller(rootRef.current?.closest("main") ?? null);
  }, []);

  useEffect(() => {
    const element = rootRef.current?.closest("main");
    if (!element) return;
    const update = () => onScrollTopChange(element.scrollTop <= 8);
    update();
    element.addEventListener("scroll", update, { passive: true });
    return () => element.removeEventListener("scroll", update);
  }, [onScrollTopChange, state]);

  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!scroller || !element) {
      setScrollMargin(0);
      return;
    }

    const update = () => {
      const top =
        element.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      setScrollMargin(Math.max(0, top));
    };
    update();

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    observer?.observe(scroller);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [scroller, alerts.length, state]);

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
    estimateSize: () => 36,
    overscan: 8,
    scrollMargin,
    getItemKey: (index) => {
      const row = displayRows[index];
      return row ? `${row.kind}:${row.alert.id}` : index;
    },
  });

  const virtualItems = scroller ? virtualizer.getVirtualItems() : [];
  const paddingTop =
    virtualItems.length > 0 ? Math.max(0, virtualItems[0].start - scrollMargin) : 0;
  const lastItem = virtualItems[virtualItems.length - 1];
  const paddingBottom = lastItem
    ? Math.max(0, virtualizer.getTotalSize() - lastItem.end)
    : 0;

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

  function renderRow(row: DisplayRow, dataIndex?: number, measureRef?: (element: HTMLTableRowElement | null) => void) {
    if (row.kind === "ack-error") {
      return (
        <tr key={`ack-error:${row.alert.id}`} ref={measureRef} data-index={dataIndex}>
          <td colSpan={COLUMNS.length} className="border-b border-border px-3 py-2">
            <InlineError
              error={row.error.error}
              copy={{ title: row.error.title, detail: row.error.detail }}
              onRetry={() => onAck(row.alert)}
            />
          </td>
        </tr>
      );
    }
    return (
      <AlertRow
        key={`alert:${row.alert.id}`}
        alert={row.alert}
        zoneLabel={zoneFor(row.alert)}
        tripLabel={tripFor(row.alert)}
        onOpen={() => onOpen(row.alert.id)}
        onAck={() => onAck(row.alert)}
        pending={pendingId === row.alert.id}
        disabledReason={disabledReason}
        highlighted={highlightIds.has(row.alert.id)}
        {...(dataIndex !== undefined ? { dataIndex } : {})}
        {...(measureRef ? { measureRef } : {})}
      />
    );
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
      className="min-h-48"
    >
      {state === "error" && alerts.length === 0 ? null : (
        <div ref={rootRef} className="relative">
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Plate</TH>
                <TH>Type</TH>
                <TH className="hidden md:table-cell">Severity</TH>
                <TH>Status</TH>
                <TH className="hidden lg:table-cell">Zone</TH>
                <TH className="hidden lg:table-cell">Trip</TH>
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {scroller ? (
                <>
                  {paddingTop > 0 ? <SpacerRow height={paddingTop} /> : null}
                  {virtualItems.map((virtualRow) => {
                    const row = displayRows[virtualRow.index];
                    if (!row) return null;
                    return renderRow(
                      row,
                      virtualRow.index,
                      (element) => {
                        if (element) virtualizer.measureElement(element);
                      },
                    );
                  })}
                  {paddingBottom > 0 ? <SpacerRow height={paddingBottom} /> : null}
                </>
              ) : (
                displayRows.map((row) => renderRow(row))
              )}
            </TBody>
          </Table>

          {hasMore ? (
            <div className="flex justify-center py-3">
              <Button size="sm" onClick={onLoadMore} loading={loadingMore}>
                Load more
              </Button>
            </div>
          ) : null}

          <AlertNewPill count={newCount} onReveal={onRevealNew} />
        </div>
      )}
    </StateBoundary>
  );
}

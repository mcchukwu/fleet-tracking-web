import { Fragment, useEffect, useRef } from "react";
import type { Alert } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import { SlowNotice } from "../../../errors/SlowNotice";
import { Button } from "../../../ui/Button";
import { EmptyState, Skeleton } from "../../../ui/StatePanel";
import { StateBoundary, type StateBoundaryState } from "../../../ui/StateBoundary";
import { Table, TBody, TH, THead, TR } from "../../../ui/Table";
import { InlineError } from "../../../errors/InlineError";
import type { AckErrorState } from "../hooks/useAlertAck";
import type { AlertEmptyReason } from "../lib/filter";
import { AlertNewPill } from "./AlertNewPill";
import { AlertRow } from "./AlertRow";

const COLUMNS = ["Time", "Plate", "Type", "Severity", "Status", "Zone", "Trip", ""] as const;

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
}: AlertTableProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = rootRef.current?.closest("main");
    if (!scroller) return;
    const update = () => onScrollTopChange(scroller.scrollTop <= 8);
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    return () => scroller.removeEventListener("scroll", update);
  }, [onScrollTopChange, state]);

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
      className="min-h-48"
    >
      <div
        ref={rootRef}
        className="relative"
      >
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
            {alerts.map((alert) => (
              <Fragment key={alert.id}>
                <AlertRow
                  alert={alert}
                  zoneLabel={zoneFor(alert)}
                  tripLabel={tripFor(alert)}
                  onOpen={() => onOpen(alert.id)}
                  onAck={() => onAck(alert)}
                  pending={pendingId === alert.id}
                  disabledReason={disabledReason}
                  highlighted={highlightIds.has(alert.id)}
                />
                {ackError?.alertId === alert.id ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="border-b border-border px-3 py-2">
                      <InlineError
                        error={ackError.error}
                        copy={{ title: ackError.title, detail: ackError.detail }}
                        onRetry={() => onAck(alert)}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
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
    </StateBoundary>
  );
}

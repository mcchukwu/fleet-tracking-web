import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AuditEntry } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import { SlowNotice } from "../../../errors/SlowNotice";
import {
  MISSING,
  formatRelativeTime,
  formatTimeTooltip,
} from "../../../lib/format";
import { useNow } from "../../../lib/ticker";
import { Button } from "../../../ui/Button";
import { CopyButton } from "../../../ui/CopyButton";
import {
  DataTable,
  DATA_TABLE_ROW_HEIGHT,
  type DataTableColumn,
} from "../../../ui/DataTable";
import { EmptyState, Skeleton } from "../../../ui/StatePanel";
import { StateBoundary, type StateBoundaryState } from "../../../ui/StateBoundary";
import { cn } from "../../../ui/cn";
import {
  auditActionLabel,
  auditEntityLabel,
  metadataSummary,
  type AuditEmptyReason,
} from "../lib/audit";

const COLUMN_WIDTHS = {
  time: 128,
  actor: 160,
  action: 200,
  entity: 110,
  entityId: 300,
  details: 280,
} as const;

const COLUMN_ORDER = [
  ["time", "Time"],
  ["actor", "Actor"],
  ["action", "Action"],
  ["entity", "Entity"],
  ["entityId", "Entity ID"],
  ["details", "Details"],
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

function AuditTimeCell({ entry, onOpen }: { entry: AuditEntry; onOpen: () => void }) {
  const now = useNow();
  const relative = formatRelativeTime(entry.created_at, now);
  const tooltip = formatTimeTooltip(entry.created_at);

  return (
    <button
      type="button"
      data-audit-id={String(entry.id)}
      aria-label={`Open audit entry: ${auditActionLabel(entry.action)} by ${
        entry.user_name || MISSING
      }, ${relative}, ${tooltip}`}
      title={tooltip}
      onClick={onOpen}
      className="text-muted hover:text-text focus-visible:outline-focus-ring min-w-touch -my-2 inline-flex h-touch items-center justify-start rounded-sm text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-offset-0 md:my-0 md:h-auto md:min-w-0"
    >
      <time dateTime={entry.created_at}>{relative}</time>
    </button>
  );
}

function AuditTableSkeleton() {
  return (
    <output aria-busy="true" aria-label="Loading audit log" className="block">
      <div className="border-border overflow-x-auto rounded-lg border">
        <table
          className="w-full table-fixed border-collapse text-sm"
          style={tableMinWidth(TABLE_MIN_WIDTH)}
        >
          <thead className="bg-surface-2">
            <tr className="h-row border-border border-b">
              {COLUMN_ORDER.map(([id, label]) => (
                <th
                  key={id}
                  scope="col"
                  data-column-id={id}
                  className="label-caps text-muted h-row px-3 py-0 text-left"
                  style={cellWidth(COLUMN_WIDTHS[id])}
                >
                  {label}
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
                  <td key={id} className="px-3 py-0" data-column-id={id}>
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

export interface AuditTableProps {
  entries: AuditEntry[];
  state: StateBoundaryState;
  error?: AppError | null;
  onRetry: () => void;
  onCancelLoading?: () => void;
  onOpen: (id: AuditEntry["id"]) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  offline?: boolean;
  staleLabel?: string;
  cancelled?: boolean;
  emptyReason: AuditEmptyReason | null;
  onClearFilters: () => void;
  forbiddenAction?: ReactNode;
  selectedId: string | null;
  resetKey?: string;
}

export function AuditTable({
  entries,
  state,
  error,
  onRetry,
  onCancelLoading,
  onOpen,
  onLoadMore,
  hasMore,
  loadingMore,
  offline = false,
  staleLabel,
  cancelled = false,
  emptyReason,
  onClearFilters,
  forbiddenAction,
  selectedId,
  resetKey,
}: AuditTableProps) {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (scroller) scrollToTop(scroller);
  }, [resetKey, scroller]);

  // oxlint-disable-next-line react/incompatible-library -- TanStack Virtual returns stable observers; this component does not memoize the handle.
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scroller,
    estimateSize: () => DATA_TABLE_ROW_HEIGHT,
    overscan: 8,
    scrollMargin: DATA_TABLE_ROW_HEIGHT,
    getItemKey: (index) => String(entries[index]?.id ?? index),
  });

  const virtualItems = scroller ? virtualizer.getVirtualItems() : [];
  const virtualRows = virtualItems.flatMap((item) => {
    const entry = entries[item.index];
    return entry ? [entry] : [];
  });
  const rowsToRender =
    scroller && (virtualItems.length > 0 || entries.length === 0)
      ? virtualRows
      : entries;

  const paddingTop =
    virtualItems.length > 0
      ? Math.max(0, virtualItems[0].start - DATA_TABLE_ROW_HEIGHT)
      : 0;
  const lastItem = virtualItems[virtualItems.length - 1];
  const paddingBottom = lastItem
    ? Math.max(0, virtualizer.getTotalSize() - lastItem.end)
    : 0;

  const columns = useMemo<DataTableColumn<AuditEntry>[]>(
    () => [
      {
        id: "time",
        header: "Time",
        width: COLUMN_WIDTHS.time,
        align: "left",
        cell: (entry) => (
          <AuditTimeCell entry={entry} onOpen={() => onOpen(entry.id)} />
        ),
      },
      {
        id: "actor",
        header: "Actor",
        width: COLUMN_WIDTHS.actor,
        align: "left",
        title: (entry) => entry.user_name || MISSING,
        cell: (entry) => (
          <span className="text-text text-sm">{entry.user_name || MISSING}</span>
        ),
      },
      {
        id: "action",
        header: "Action",
        width: COLUMN_WIDTHS.action,
        align: "left",
        title: (entry) => entry.action,
        cell: (entry) => (
          <span className="text-text text-sm">{auditActionLabel(entry.action)}</span>
        ),
      },
      {
        id: "entity",
        header: "Entity",
        width: COLUMN_WIDTHS.entity,
        align: "left",
        title: (entry) => entry.entity,
        cell: (entry) => (
          <span className="text-muted text-sm">{auditEntityLabel(entry.entity)}</span>
        ),
      },
      {
        id: "entityId",
        header: "Entity ID",
        width: COLUMN_WIDTHS.entityId,
        align: "left",
        truncate: false,
        title: (entry) => entry.entity_id || MISSING,
        cell: (entry) =>
          entry.entity_id ? (
            <CopyButton
              inline
              value={entry.entity_id}
              label="entity id"
              className="text-xs"
            />
          ) : (
            <span className="text-muted text-sm">{MISSING}</span>
          ),
      },
      {
        id: "details",
        header: "Details",
        width: COLUMN_WIDTHS.details,
        align: "left",
        title: (entry) => metadataSummary(entry.metadata),
        cell: (entry) => (
          <span className="text-muted text-sm">{metadataSummary(entry.metadata)}</span>
        ),
      },
    ],
    [onOpen],
  );

  const empty = cancelled ? (
    <EmptyState
      title="Loading cancelled"
      description="The audit log request was cancelled."
      action={
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      }
    />
  ) : emptyReason === "offline" ? (
    <EmptyState
      title="Audit isn't available offline"
      description="Reconnect to read the audit log. It isn't stored on this device."
    />
  ) : emptyReason === "no-loaded-matches" ? (
    <EmptyState
      title="No matches in the loaded log"
      description="Older entries may match. Load more to search further."
      action={
        <Button
          size="sm"
          onClick={onLoadMore}
          loading={loadingMore}
          {...(offline ? { disabledReason: "You're offline." } : {})}
        >
          Load more
        </Button>
      }
    />
  ) : emptyReason === "no-results" ? (
    <EmptyState
      title="No entries match"
      description="Try a different search or clear the filters."
      action={
        <Button size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      title="No audit entries yet"
      description="Actions appear here as people use the console."
    />
  );

  const showRows = !(state === "error" && entries.length === 0);

  return (
    <StateBoundary
      state={state}
      error={error}
      onRetry={onRetry}
      loading={
        <div>
          <SlowNotice onRetry={onRetry} onCancel={onCancelLoading} />
          <AuditTableSkeleton />
        </div>
      }
      empty={empty}
      staleLabel={staleLabel}
      forbiddenAction={forbiddenAction}
      className="flex min-h-0 flex-1 flex-col"
    >
      {showRows ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <DataTable
            label="Audit log"
            columns={columns}
            rows={rowsToRender}
            rowKey={(entry, index) => `${String(entry.id)}:${index}`}
            className="min-h-0 flex-1"
            topSpacer={paddingTop}
            bottomSpacer={paddingBottom}
            onScrollerChange={setScroller}
            selected={(entry) => String(entry.id) === selectedId}
            rowProps={(entry) => ({
              className: cn(
                "group cursor-pointer",
                String(entry.id) === selectedId && "bg-accent-soft",
              ),
              onClick: (event) => {
                if ((event.target as HTMLElement).closest("button, a")) return;
                onOpen(entry.id);
              },
            })}
          />

          {hasMore ? (
            <div className="flex shrink-0 justify-center py-3">
              <Button
                size="sm"
                onClick={onLoadMore}
                loading={loadingMore}
                {...(offline ? { disabledReason: "You're offline." } : {})}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </StateBoundary>
  );
}

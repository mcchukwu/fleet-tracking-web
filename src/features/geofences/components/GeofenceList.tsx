import { useEffect, useState, type ReactNode } from "react";
import type { Geofence } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import { SlowNotice } from "../../../errors/SlowNotice";
import { formatCount } from "../../../lib/format";
import { Button } from "../../../ui/Button";
import { EmptyState, Skeleton } from "../../../ui/StatePanel";
import { StateBoundary, type StateBoundaryState } from "../../../ui/StateBoundary";
import { SearchInput } from "../../../ui/SearchInput";
import { GeofenceLegend } from "./GeofenceLegend";
import { GeofenceRow } from "./GeofenceRow";
import { GeofenceToolbar } from "./GeofenceToolbar";

export type GeofenceEmptyReason = "no-data" | "no-results";

export interface GeofenceListProps {
  geofences: Geofence[];
  total: number;
  q: string;
  selected: Geofence | null;
  state: StateBoundaryState;
  error?: AppError | null;
  staleLabel?: string;
  cancelled: boolean;
  offline: boolean;
  canMutate: boolean;
  notFound: boolean;
  forbiddenAction?: ReactNode;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreate: () => void;
  onClearSelection: () => void;
  onRetry: () => void;
  onCancelLoading: () => void;
  resetKey?: string;
}

function scrollToTop(element: HTMLElement | null): void {
  if (!element) return;
  if (typeof element.scrollTo === "function") {
    element.scrollTo({ top: 0, behavior: "auto" });
    return;
  }
  element.scrollTop = 0;
}

function GeofenceListSkeleton() {
  return (
    <output aria-busy="true" aria-label="Loading geofences" className="block">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="border-border flex h-12 items-center gap-2 border-b px-3">
          <Skeleton className="h-status w-12 rounded-full" />
          <Skeleton className="w-1/2" />
        </div>
      ))}
    </output>
  );
}

export function GeofenceList({
  geofences,
  total,
  q,
  selected,
  state,
  error,
  staleLabel,
  cancelled,
  offline,
  canMutate,
  notFound,
  forbiddenAction,
  onSearch,
  onSelect,
  onEdit,
  onDelete,
  onCreate,
  onClearSelection,
  onRetry,
  onCancelLoading,
  resetKey,
}: GeofenceListProps) {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);

  useEffect(() => {
    scrollToTop(scroller);
  }, [resetKey, scroller]);

  const query = q.trim();
  const empty =
    cancelled ? (
      <EmptyState
        title="Loading cancelled"
        description="The geofence list request was cancelled."
        action={
          <Button size="sm" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    ) : offline && total === 0 ? (
      <EmptyState
        title="No geofences available offline"
        description="Reconnect to load the geofence list."
      />
    ) : query !== "" ? (
      <EmptyState
        title={`No geofences match "${query}".`}
        description={`Clear the search to see all ${formatCount(total)}.`}
        action={
          <Button size="sm" onClick={() => onSearch("")}>
            Clear search
          </Button>
        }
      />
    ) : (
      <EmptyState
        title={total === 0 ? "No geofences yet" : "No geofences to show"}
        description={
          total === 0
            ? canMutate
              ? "Draw the first one to start tracking zone events."
              : "No geofences have been created."
            : "Clear the search to see them."
        }
        action={
          total === 0 && canMutate ? (
            <Button size="sm" onClick={onCreate}>
              Create geofence
            </Button>
          ) : undefined
        }
      />
    );

  return (
    <section aria-label="Geofence list" className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex shrink-0 items-center gap-2 border-b p-3">
        <div className="min-w-0 flex-1">
          <SearchInput
            value={q}
            onChange={onSearch}
            label="Search geofences"
            placeholder="Search by name"
            name="geofence-search"
            shortcutHint={false}
          />
        </div>
        <GeofenceLegend />
      </div>

      <GeofenceToolbar
        selected={selected}
        canMutate={canMutate}
        offline={offline}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      {notFound ? (
        <output className="border-border bg-idle-bg flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-idle-fg text-sm">This geofence no longer exists.</span>
          <Button size="sm" variant="ghost" onClick={onClearSelection}>
            Clear selection
          </Button>
        </output>
      ) : null}

      <div
        ref={setScroller}
        data-geofence-scroller
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <StateBoundary
          state={state}
          error={error}
          onRetry={onRetry}
          loading={
            <div>
              <SlowNotice onRetry={onRetry} onCancel={onCancelLoading} />
              <GeofenceListSkeleton />
            </div>
          }
          empty={empty}
          staleLabel={staleLabel}
          forbiddenAction={forbiddenAction}
          className="flex min-h-0 flex-col"
        >
          {geofences.length > 0 ? (
            <ul aria-label="Geofences" className="flex flex-col">
              {geofences.map((geofence) => (
                <GeofenceRow
                  key={geofence.id}
                  geofence={geofence}
                  selected={selected?.id === geofence.id}
                  onSelect={() => onSelect(geofence.id)}
                />
              ))}
            </ul>
          ) : null}
        </StateBoundary>
      </div>
    </section>
  );
}

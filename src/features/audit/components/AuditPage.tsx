import { useMemo } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useAuditLookup } from "../../../api/hooks/audit";
import { normalize } from "../../../errors/normalize";
import { formatClockTime, formatCount } from "../../../lib/format";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import type { AuditSearch } from "../../../app/search";
import { Button } from "../../../ui/Button";
import type { StateBoundaryState } from "../../../ui/StateBoundary";
import { useAuditFeed } from "../hooks/useAuditFeed";
import {
  auditActionOptions,
  emptyAuditReason,
  filterAuditEntries,
  findAuditEntry,
  type AuditFilterValues,
} from "../lib/audit";
import { AuditDetailPanel, type AuditLookupState } from "./AuditDetailPanel";
import { AuditFilters } from "./AuditFilters";
import { AuditTable } from "./AuditTable";

/** Dev-only render-crash injection for the e2e fault matrix. */
const INJECT_CRASH =
  import.meta.env.DEV &&
  import.meta.env.VITE_MOCK === "1" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("crash") === "audit";

export function AuditPage() {
  if (INJECT_CRASH) throw new Error("Injected audit crash");
  return <AuditPageContent />;
}

function AuditPageContent() {
  const search = useSearch({ from: "/_app/audit" });
  const navigate = useNavigate();
  const feed = useAuditFeed();
  useDocumentTitle("Audit");

  const filters = useMemo<AuditFilterValues>(
    () => ({ action: search.action ?? null, q: search.q ?? "" }),
    [search.action, search.q],
  );

  const entries = useMemo(() => filterAuditEntries(feed.entries, filters), [feed.entries, filters]);
  const actionOptions = useMemo(
    () => auditActionOptions(feed.entries, filters.action),
    [feed.entries, filters.action],
  );

  const selectedId =
    search.entry === undefined ? null : String(search.entry);
  const selectedInFeed = findAuditEntry(feed.entries, selectedId);
  const lookupEnabled =
    selectedId !== null && selectedInFeed === null && !feed.isLoading;
  const lookup = useAuditLookup(selectedId, lookupEnabled && feed.online);
  const selectedEntry = selectedInFeed ?? lookup.data ?? null;
  const lookupState: AuditLookupState =
    selectedId === null
      ? "ready"
      : selectedInFeed !== null
        ? "ready"
        : !feed.online && !lookup.data
          ? "offline"
          : feed.isLoading || lookup.isPending
            ? "loading"
            : lookup.error
              ? "error"
              : lookup.data
                ? "ready"
                : "not-found";

  const offline = !feed.online;
  const filtered = filters.action !== null || filters.q.trim() !== "";
  const closedError = !offline && feed.error ? normalize(feed.error) : null;

  const state: StateBoundaryState =
    closedError?.kind === "forbidden"
      ? "forbidden"
      : feed.isLoading && entries.length === 0
        ? "loading"
        : closedError
          ? "error"
          : entries.length === 0
            ? "empty"
            : offline
              ? "stale"
              : "ready";

  const emptyReason = emptyAuditReason({
    loadedCount: feed.loadedCount,
    visibleCount: entries.length,
    hasMore: feed.hasMore,
    filtered,
    online: feed.online,
  });

  function updateSearch(patch: Partial<AuditSearch>, replace = true): void {
    void navigate({ to: "/audit", search: { ...search, ...patch }, replace });
  }

  function changeFilters(patch: Partial<AuditFilterValues>): void {
    const next: Partial<AuditSearch> = { entry: undefined };
    if ("action" in patch) next.action = patch.action ?? undefined;
    if ("q" in patch) next.q = patch.q ?? undefined;
    updateSearch(next);
  }

  function resetFilters(): void {
    updateSearch({ q: undefined, action: undefined, entry: undefined });
  }

  function closeEntry(): void {
    const origin = selectedId;
    updateSearch({ entry: undefined });
    focusRow(origin);
  }

  function focusRow(id: string | null): void {
    setTimeout(() => {
      if (id) {
        const target = document.querySelector<HTMLElement>(
          `[data-audit-id="${CSS.escape(id)}"]`,
        );
        if (target) {
          target.focus();
          return;
        }
      }
      const searchField = document.querySelector<HTMLElement>(
        '[data-testid="audit-page"] input[type="search"]',
      );
      if (searchField) {
        searchField.focus();
        return;
      }
      document.querySelector<HTMLElement>("[data-refresh-audit]")?.focus();
    }, 0);
  }

  const countLabel = filtered
    ? `${formatCount(entries.length)} of ${formatCount(feed.loadedCount)} loaded`
    : `${formatCount(feed.loadedCount)} ${
        feed.loadedCount === 1 ? "entry" : "entries"
      } loaded`;
  const showCount =
    state !== "forbidden" &&
    !feed.isLoading &&
    !(state === "error" && feed.loadedCount === 0);

  return (
    <div
      data-testid="audit-page"
      className="max-w-content text-text relative mx-auto flex h-full min-h-0 w-full flex-col px-4 py-6 sm:px-6"
    >
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-text text-lg font-semibold">Audit</h1>
          {showCount ? (
            <p className="text-muted text-sm tabular-nums">{countLabel}</p>
          ) : null}
        </div>
        {state !== "forbidden" ? (
          <Button
            variant="secondary"
            data-refresh-audit
            loading={feed.isFetching && !feed.isFetchingNextPage}
            {...(offline ? { disabledReason: "You're offline." } : {})}
            onClick={feed.refetch}
          >
            Refresh
          </Button>
        ) : null}
      </header>

      <AuditFilters
        values={filters}
        actionOptions={actionOptions}
        onChange={changeFilters}
        onReset={resetFilters}
        className="shrink-0"
      />

      {feed.cancelled && feed.loadedCount === 0 ? (
        <output className="border-border bg-surface-2 mb-3 flex items-center justify-between gap-2 rounded-md border px-3 py-2">
          <span className="text-muted text-sm">Loading cancelled</span>
          <Button size="sm" variant="ghost" onClick={feed.refetch}>
            Retry
          </Button>
        </output>
      ) : null}

      <AuditTable
        entries={entries}
        state={state}
        error={closedError}
        onRetry={feed.refetch}
        onCancelLoading={feed.cancel}
        onOpen={(id) => updateSearch({ entry: id }, false)}
        onLoadMore={feed.loadMore}
        hasMore={feed.hasMore}
        loadingMore={feed.isFetchingNextPage}
        offline={offline}
        {...(offline && feed.dataUpdatedAt
          ? { staleLabel: formatClockTime(feed.dataUpdatedAt) }
          : {})}
        emptyReason={emptyReason}
        onClearFilters={resetFilters}
        selectedId={selectedId}
        resetKey={`${filters.action ?? ""}:${filters.q}`}
        forbiddenAction={
          <Link
            to="/map"
            className="h-touch text-accent-fg md:h-control-md inline-flex items-center text-sm font-medium underline-offset-4 hover:underline"
          >
            Go back
          </Link>
        }
      />

      {selectedId && state !== "forbidden" ? (
        <AuditDetailPanel
          entry={selectedEntry}
          lookup={lookupState}
          lookupError={lookup.error ? normalize(lookup.error) : null}
          onClose={closeEntry}
          onRetryLookup={() => void lookup.refetch()}
          returnFocus={() => focusRow(selectedId)}
        />
      ) : null}
    </div>
  );
}

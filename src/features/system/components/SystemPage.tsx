import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useErrorStorm } from "../../../errors/global";
import { ErrorState } from "../../../errors/ErrorState";
import { normalize } from "../../../errors/normalize";
import { SlowNotice } from "../../../errors/SlowNotice";
import { formatClockTime } from "../../../lib/format";
import { useDelayedFlag } from "../../../lib/useDelayedFlag";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useNow } from "../../../lib/ticker";
import { useConnection } from "../../../stores/connection";
import { Button } from "../../../ui/Button";
import { EmptyState, Skeleton } from "../../../ui/StatePanel";
import {
  StateBoundary,
  type StateBoundaryState,
} from "../../../ui/StateBoundary";
import { useSystemHealthFeed } from "../hooks/useSystemHealthFeed";
import {
  buildHealthGroups,
  healthSummary,
  type HealthSummary,
} from "../lib/health";
import { SystemHealthGroup } from "./SystemHealthGroup";
import { SystemSkeleton } from "./SystemSkeleton";
import { SystemSummary } from "./SystemSummary";
import { SystemUpdated } from "./SystemUpdated";

/** Dev-only render-crash injection for the e2e fault matrix. */
const INJECT_CRASH =
  import.meta.env.DEV &&
  import.meta.env.VITE_MOCK === "1" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("crash") === "system";

export function SystemPage() {
  if (INJECT_CRASH) throw new Error("Injected system health crash");
  return <SystemPageContent />;
}

function SystemPageContent() {
  useDocumentTitle("System health");
  const feed = useSystemHealthFeed();
  const { lastDataAt } = useConnection();
  const now = useNow();
  const storm = useErrorStorm();
  const retryRef = useRef<HTMLButtonElement>(null);

  const cached = feed.data !== undefined;
  const cancelled = feed.cancelled && !cached;
  const error = feed.online && feed.error ? normalize(feed.error) : null;
  const forbidden = error?.kind === "forbidden";
  const pendingFirstLoad =
    feed.isFetching && !cached && !cancelled && feed.online;

  const groups = useMemo(
    () =>
      feed.data
        ? buildHealthGroups(feed.data, lastDataAt, feed.trend, now)
        : [],
    [feed.data, feed.trend, lastDataAt, now],
  );
  const summary: HealthSummary = useMemo(
    () => healthSummary(groups),
    [groups],
  );

  const state: StateBoundaryState = !feed.online && !cached
    ? "empty"
    : forbidden
      ? "forbidden"
      : !cached && error
        ? "error"
        : !cached && (feed.isPending || feed.isFetching)
          ? "loading"
          : error
            ? "error"
            : !feed.online && cached
              ? "stale"
              : "ready";

  const showLoading = useDelayedFlag(state === "loading");

  useEffect(() => {
    if (cancelled) retryRef.current?.focus();
  }, [cancelled]);

  const refreshVisible = cached && !error;

  return (
    <div
      data-testid="system-page"
      className="max-w-content text-text mx-auto flex w-full flex-col gap-4 px-4 py-6 sm:px-6"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-text text-lg font-semibold">System health</h1>
        {feed.data && !forbidden ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SystemSummary summary={summary} />
            <SystemUpdated
              at={feed.dataUpdatedAt}
              now={now}
              online={feed.online}
              fetching={feed.isFetching}
              showRefresh={refreshVisible}
              onRefresh={feed.refetch}
            />
          </div>
        ) : showLoading && !cancelled ? (
          <div
            data-health-header-skeleton
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-touch w-24 md:h-control-sm" />
          </div>
        ) : null}
      </header>

      {pendingFirstLoad ? (
        <SlowNotice onCancel={feed.cancel} onRetry={feed.refetch} />
      ) : null}

      {cancelled ? (
        <div className="border-border bg-surface flex items-center justify-between gap-2 rounded-lg border px-4 py-3">
          <p className="text-muted text-sm">Loading cancelled</p>
          <Button
            ref={retryRef}
            size="sm"
            variant="ghost"
            onClick={feed.refetch}
          >
            Retry
          </Button>
        </div>
      ) : (
        <Boundary
          state={state}
          feed={feed}
          error={error}
          storm={storm}
          groups={groups}
          cached={cached}
        />
      )}
    </div>
  );
}

function Boundary({
  state,
  feed,
  error,
  storm,
  groups,
  cached,
}: {
  state: StateBoundaryState;
  feed: ReturnType<typeof useSystemHealthFeed>;
  error: ReturnType<typeof normalize> | null;
  storm: boolean;
  groups: ReturnType<typeof buildHealthGroups>;
  cached: boolean;
}) {
  if (state === "error" && !cached && error) {
    return (
      <ErrorState
        error={error}
        onRetry={feed.refetch}
        compact={storm}
        titleOverride={apiTitle(error.kind)}
      />
    );
  }

  return (
    <StateBoundary
      state={state}
      error={error}
      onRetry={feed.refetch}
      loading={<SystemSkeleton />}
      {...(cached
        ? { staleLabel: formatClockTime(feed.dataUpdatedAt) }
        : {})}
      empty={
        <EmptyState
          title="System health isn't available offline"
          description="Reconnect to read the current health. No cached values are available on this device."
        />
      }
      forbiddenAction={
        <Link
          to="/map"
          className="h-touch text-accent-fg md:h-control-md inline-flex items-center text-sm font-medium underline-offset-4 hover:underline"
        >
          Go back
        </Link>
      }
    >
      {cached ? (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <SystemHealthGroup
              key={group.id}
              id={group.id}
              title={group.title}
              description={group.description}
              items={group.items}
              columns={group.columns}
            />
          ))}
        </div>
      ) : null}
    </StateBoundary>
  );
}

function apiTitle(kind: string): string | undefined {
  return kind === "network" ||
    kind === "timeout" ||
    kind === "server" ||
    kind === "unavailable"
    ? "Can't reach the API"
    : undefined;
}

import type { AppError } from "../../../errors/types";
import { formatCount } from "../../../lib/format";
import type { RecentImport } from "../../../lib/importHistory";
import { useDelayedFlag } from "../../../lib/useDelayedFlag";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { Skeleton } from "../../../ui/StatePanel";
import { Timestamp } from "../../../ui/Timestamp";

export type RecentImportsState = "loading" | "ready" | "error";

export interface ImportRecentListProps {
  entries: readonly RecentImport[];
  state: RecentImportsState;
  error: AppError | null;
  onView: (entry: RecentImport) => void;
  onRetry: () => void;
}

function RecentSkeleton() {
  return (
    <div
      data-testid="import-recent-loading"
      aria-busy="true"
      aria-label="Loading recent imports"
      className="flex flex-col gap-2"
    >
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="flex min-h-14 items-center gap-3 px-1">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="w-40" />
            <Skeleton className="w-56" />
          </div>
          <Skeleton className="w-16" />
        </div>
      ))}
    </div>
  );
}

export function ImportRecentList({
  entries,
  state,
  error,
  onView,
  onRetry,
}: ImportRecentListProps) {
  const showSkeleton = useDelayedFlag(state === "loading");
  const writeFailed = error !== null && state !== "error";

  return (
    <section
      aria-labelledby="import-recent-title"
      data-testid="import-recent"
      className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="import-recent-title" className="text-text text-sm font-medium">
          Recent imports
        </h2>
        <Badge tone="neutral">This device</Badge>
      </div>
      <p className="text-muted text-xs">
        The server has no import history. These results are on this device only.
      </p>

      {writeFailed ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-danger text-sm">
            This import worked, but this device couldn't save it to Recent imports.
          </p>
          <Button size="sm" variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}

      {state === "loading" ? (
        showSkeleton ? (
          <RecentSkeleton />
        ) : null
      ) : state === "error" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted text-sm">Recent imports aren't available on this device.</p>
          <Button size="sm" variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-muted text-sm">No imports on this device yet.</p>
      ) : (
        <ul className="flex flex-col" data-testid="import-recent-list">
          {entries.map((entry) => (
            <li
              key={entry.jobId}
              data-recent-import={entry.jobId}
              className="border-border flex h-14 items-center justify-between gap-2 border-b last:border-b-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-text truncate font-mono text-xs" title={entry.fileName}>
                  {entry.fileName}
                </span>
                <span className="text-muted flex items-center gap-1 overflow-hidden text-xs whitespace-nowrap tabular-nums">
                  <span>{formatCount(entry.imported)} imported</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatCount(entry.failed)} failed</span>
                  <span aria-hidden="true">·</span>
                  <Timestamp iso={entry.completedAt} />
                </span>
              </div>
              <Button
                size="sm"
                aria-label={`View result for ${entry.fileName}`}
                onClick={() => onView(entry)}
              >
                View result
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

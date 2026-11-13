import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { ErrorState } from "../errors/ErrorState";
import { useErrorStorm } from "../errors/global";
import { useDelayedFlag } from "../lib/useDelayedFlag";
import type { AppError } from "../errors/types";
import { cn } from "./cn";
import { EmptyState, ForbiddenState, LoadingState } from "./StatePanel";

export type StateBoundaryState = "loading" | "empty" | "error" | "stale" | "forbidden" | "ready";

export interface StateBoundaryProps {
  state: StateBoundaryState;
  error?: AppError | null;
  onRetry?: () => void;
  loading?: ReactNode;
  empty?: ReactNode;
  emptyReason?: "no-data" | "no-results";
  forbiddenAction?: ReactNode;
  staleLabel?: string;
  pending?: boolean;
  className?: string;
  /** Test hook for a fill page's designated scrollport. */
  testId?: string;
  children?: ReactNode;
}

const fallbackError: AppError = {
  kind: "network",
  retryable: true,
  outcome: "failed",
  context: { route: "/" },
  at: 0,
};

export function StateBoundary({
  state,
  error,
  onRetry,
  loading,
  empty,
  emptyReason = "no-data",
  forbiddenAction,
  staleLabel,
  pending = false,
  className,
  testId,
  children,
}: StateBoundaryProps) {
  const storm = useErrorStorm();
  const showLoading = useDelayedFlag(state === "loading");

  if (state === "loading") {
    return (
      <div data-testid={testId} className={className}>
        {showLoading ? (loading ?? <LoadingState />) : null}
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div data-testid={testId} className={className}>
        {empty ??
          (emptyReason === "no-results" ? (
            <EmptyState
              title="No matches"
              description="Try a different search or clear the filters."
            />
          ) : (
            <EmptyState
              title="Nothing here yet"
              description="This will fill in once there is data to show."
            />
          ))}
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div data-testid={testId} className={className}>
        <ForbiddenState action={forbiddenAction} />
      </div>
    );
  }

  if (state === "error") {
    const resolved = error ?? fallbackError;
    if (!children) {
      return (
        <div data-testid={testId} className={className}>
          <ErrorState error={resolved} onRetry={onRetry} compact={storm} />
        </div>
      );
    }
    return (
      <div data-testid={testId} className={className}>
        <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <p className="text-muted text-sm">Couldn't refresh</p>
            {staleLabel && staleLabel !== "—" ? (
              <Badge tone="warning">Stale · {staleLabel}</Badge>
            ) : null}
          </div>
          {onRetry ? (
            <Button size="sm" variant="ghost" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      className={cn(pending && "opacity-60", className)}
      aria-busy={pending || undefined}
    >
      {state === "stale" ? (
        <div className="flex items-center justify-end px-3 py-2">
          <Badge tone="warning">Stale · {staleLabel ?? "unknown"}</Badge>
        </div>
      ) : null}
      {children}
    </div>
  );
}

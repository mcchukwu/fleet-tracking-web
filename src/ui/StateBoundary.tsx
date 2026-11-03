import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { ErrorState } from "../errors/ErrorState";
import type { AppError } from "../errors/types";
import { cn } from "./cn";
import { EmptyState, ForbiddenState, LoadingState } from "./StatePanel";

export type StateBoundaryState =
  | "loading"
  | "empty"
  | "error"
  | "stale"
  | "forbidden"
  | "ready";

export interface StateBoundaryProps {
  state: StateBoundaryState;
  error?: AppError | null;
  onRetry?: () => void;
  loading?: ReactNode;
  empty?: ReactNode;
  staleLabel?: string;
  pending?: boolean;
  className?: string;
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
  staleLabel,
  pending = false,
  className,
  children,
}: StateBoundaryProps) {
  if (state === "loading") {
    return <div className={className}>{loading ?? <LoadingState />}</div>;
  }

  if (state === "empty") {
    return (
      <div className={className}>
        {empty ?? (
          <EmptyState
            title="Nothing here yet"
            description="There is nothing to show for this view."
          />
        )}
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className={className}>
        <ForbiddenState />
      </div>
    );
  }

  if (state === "error") {
    const resolved = error ?? fallbackError;
    if (!children) {
      return (
        <div className={className}>
          <ErrorState error={resolved} onRetry={onRetry} />
        </div>
      );
    }
    return (
      <div className={className}>
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm text-muted">Couldn't refresh</p>
          {onRetry ? (
            <Button size="sm" variant="ghost" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
        <div className="opacity-60">{children}</div>
      </div>
    );
  }

  return (
    <div
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

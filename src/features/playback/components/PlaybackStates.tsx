import { Button } from "../../../ui/Button";
import { EmptyState, ForbiddenState } from "../../../ui/StatePanel";
import { cn } from "../../../ui/cn";

export type PlaybackStateVariant =
  | "validation"
  | "empty"
  | "offline-uncached"
  | "cancelled"
  | "not-found"
  | "forbidden";

export interface PlaybackStatesProps {
  variant: PlaybackStateVariant;
  message?: string;
  onResetRange?: () => void;
  onRetry?: () => void;
  onBack?: () => void;
  className?: string;
}

export function PlaybackStates({
  variant,
  message,
  onResetRange,
  onRetry,
  onBack,
  className,
}: PlaybackStatesProps) {
  const reset = onResetRange ? (
    <Button size="sm" variant="ghost" onClick={onResetRange}>
      Use the last 2 hours
    </Button>
  ) : undefined;
  const back = onBack ? (
    <Button size="sm" variant="ghost" onClick={onBack}>
      Back to map
    </Button>
  ) : undefined;

  if (variant === "forbidden") {
    return (
      <div className={cn("rounded-lg border border-border bg-surface", className)}>
        <ForbiddenState action={back} />
      </div>
    );
  }

  if (variant === "validation") {
    return (
      <div className={cn("rounded-lg border border-border bg-surface p-4", className)}>
        <p className="text-base font-medium text-text">Choose a valid range</p>
        <p className="mt-1 text-sm text-muted">{message ?? "Choose a start and end time."}</p>
        <div className="mt-3">{reset}</div>
      </div>
    );
  }

  if (variant === "empty") {
    return (
      <div className={cn("rounded-lg border border-border bg-surface", className)}>
        <EmptyState
          title="No positions in this range"
          description="Try a wider range or choose another vehicle."
          action={reset}
        />
      </div>
    );
  }

  if (variant === "offline-uncached") {
    return (
      <div className={cn("rounded-lg border border-border bg-surface", className)}>
        <EmptyState
          title="Not available offline"
          description="Reconnect to load this range. Ranges you've already viewed stay available."
          action={back}
        />
      </div>
    );
  }

  if (variant === "not-found") {
    return (
      <div className={cn("rounded-lg border border-border bg-surface", className)}>
        <EmptyState
          title="Vehicle not found"
          description="It may have been removed."
          action={back}
        />
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-surface", className)}>
      <EmptyState
        title="Playback cancelled"
        description="Nothing was changed."
        action={
          <div className="flex gap-2">
            {onRetry ? (
              <Button size="sm" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
            {back}
          </div>
        }
      />
    </div>
  );
}

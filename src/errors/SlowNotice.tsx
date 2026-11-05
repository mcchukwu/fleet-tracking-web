import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { getSlowState, slowStateCopy, type SlowState } from "./slow";

const TICK_MS = 1_000;

export interface SlowNoticeProps {
  onRetry?: () => void;
  onCancel?: () => void;
}

/** Renders "Still working…" after 3s and "Taking longer than usual" after 10s. */
export function SlowNotice({ onRetry, onCancel }: SlowNoticeProps) {
  const [state, setState] = useState<SlowState | null>(null);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setState(getSlowState(startedAt, Date.now()));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const copy = slowStateCopy(state);
  if (!copy) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
      <output className="text-xs text-muted">{copy}</output>
      {state === "long" ? (
        <div className="flex items-center gap-1">
          {onCancel ? (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {onRetry ? (
            <Button size="sm" variant="ghost" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

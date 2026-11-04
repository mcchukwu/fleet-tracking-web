import { useEffect, useState } from "react";
import { getSlowState, slowStateCopy, type SlowState } from "./slow";

const TICK_MS = 1_000;

/** Renders "Still working…" after 3s and "Taking longer than usual" after 10s. */
export function SlowNotice() {
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
    <output className="block border-b border-border px-3 py-2 text-xs text-muted">
      {copy}
    </output>
  );
}

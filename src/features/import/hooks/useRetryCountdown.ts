import { useEffect, useState } from "react";
import type { AppError } from "../../../errors/types";

/** Seconds left before a rate-limited upload may be tried again, or null. */
export function useRetryCountdown(error: AppError | null): number | null {
  const endAt =
    error?.kind === "rate_limited" && error.retryAfterSec !== undefined
      ? error.at + error.retryAfterSec * 1_000
      : null;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [endAt]);

  if (endAt === null) return null;
  return Math.max(0, Math.ceil((endAt - now) / 1_000));
}

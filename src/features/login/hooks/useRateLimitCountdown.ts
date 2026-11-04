import type { AppError } from "../../../errors/types";
import { useClock } from "./useClock";

export function useRateLimitCountdown(error: AppError | null): number | null {
  const endAt =
    error?.kind === "rate_limited" && error.retryAfterSec !== undefined
      ? error.at + error.retryAfterSec * 1_000
      : null;
  const now = useClock(endAt !== null);

  if (endAt === null) return null;
  return Math.max(0, Math.ceil((endAt - now) / 1_000));
}

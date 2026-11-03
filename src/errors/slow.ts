export const SLOW_WORKING_MS = 3_000;
export const SLOW_LONG_MS = 10_000;

export type SlowState = "working" | "long";

export function getSlowState(startedAt: number, now: number): SlowState | null {
  const elapsed = now - startedAt;
  if (elapsed >= SLOW_LONG_MS) return "long";
  if (elapsed >= SLOW_WORKING_MS) return "working";
  return null;
}

export function slowStateCopy(state: SlowState | null): string | null {
  if (state === "working") return "Still working…";
  if (state === "long") return "Taking longer than usual";
  return null;
}

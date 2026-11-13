import type { SocketState } from "../../../stores/connection";

export type StaleReason = "offline" | "silent" | "socket" | "age" | null;

export interface MapFreshnessInput {
  offline: boolean;
  socket: SocketState;
  socketDownAt: number | null;
  lastDataAt: number | null;
  now: number;
  staleAfterMs: number;
  socketGraceMs: number;
}

export interface MapFreshness {
  ageSeconds: number | null;
  stale: boolean;
  reason: StaleReason;
}

/**
 * Staleness is about the live stream, not the newest vehicle timestamp: a
 * socket can be open while nothing arrives, and a fresh snapshot can hide it.
 */
export function mapFreshness({
  offline,
  socket,
  socketDownAt,
  lastDataAt,
  now,
  staleAfterMs,
  socketGraceMs,
}: MapFreshnessInput): MapFreshness {
  const ageMs = lastDataAt === null ? null : Math.max(0, now - lastDataAt);
  const ageSeconds = ageMs === null ? null : Math.floor(ageMs / 1_000);

  if (offline) return { ageSeconds, stale: true, reason: "offline" };

  const silent = socket === "live" && ageMs !== null && ageMs > socketGraceMs;
  const down = socket !== "live" && socketDownAt !== null && now - socketDownAt > socketGraceMs;
  const old = ageMs !== null && ageMs > staleAfterMs;

  return {
    ageSeconds,
    stale: silent || down || old,
    reason: silent ? "silent" : down ? "socket" : old ? "age" : null,
  };
}

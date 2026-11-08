import { REPLAY_MARGIN_MS, REPLAY_WINDOW_MS } from "./constants";

export interface ReplayRange {
  from: string;
  to: string;
}

export function replayRange(occurredAt: string): ReplayRange | null {
  const target = Date.parse(occurredAt);
  if (Number.isNaN(target)) return null;
  return {
    from: new Date(target - REPLAY_WINDOW_MS).toISOString(),
    to: new Date(target + REPLAY_MARGIN_MS).toISOString(),
  };
}

export function replaySearch(
  vehicleId: string,
  occurredAt: string,
): { vehicle: string; from: string; to: string } | null {
  const range = replayRange(occurredAt);
  if (!range) return null;
  return { vehicle: vehicleId, ...range };
}

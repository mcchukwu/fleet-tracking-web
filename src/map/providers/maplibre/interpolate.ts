import type { LngLat } from "../../types";

export const GLIDE_CAP_MS = 2_000;
export const GLIDE_SNAP_MS = 10_000;

export function glideDuration(
  previousAt: number | null,
  now: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion || previousAt === null) return 0;
  const elapsed = now - previousAt;
  if (elapsed <= 0 || elapsed > GLIDE_SNAP_MS) return 0;
  return Math.min(GLIDE_CAP_MS, elapsed);
}

export function glideProgress(startedAt: number, now: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  const progress = (now - startedAt) / durationMs;
  if (progress <= 0) return 0;
  return Math.min(1, progress);
}

export function lerpPosition(from: LngLat, to: LngLat, progress: number): LngLat {
  if (progress >= 1) return to;
  if (progress <= 0) return from;
  return [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress];
}

import type { Point } from "../../api/types";
import type { HistoryResolution } from "../../api/types";

export const GAP_VEHICLE_ID = "795b5251-1a04-475a-8df1-9aa1f9281bfc";
export const MAX_GENERATED_POINTS = 10_000;

const RESOLUTION_STEP_MS: Record<HistoryResolution, number> = {
  raw: 1_000,
  "30s": 30_000,
  "5m": 300_000,
};

/**
 * A deterministic range generator for the mock server. The designated gap
 * vehicle omits a middle slice so gap rendering can be exercised end to end.
 */
export function generateHistory(
  vehicleId: string,
  fromMs: number,
  toMs: number,
  resolution: HistoryResolution,
): Point[] {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return [];
  const step = RESOLUTION_STEP_MS[resolution];
  const start = Math.floor(fromMs / step) * step;
  const naturalCount = Math.floor((toMs - start) / step) + 1;
  const stride = Math.max(1, Math.ceil(naturalCount / MAX_GENERATED_POINTS));
  const effectiveStep = step * stride;
  const count = Math.floor((toMs - start) / effectiveStep) + 1;

  const points: Point[] = [];
  for (let index = 0; index < count; index += 1) {
    const progress = count > 1 ? index / (count - 1) : 0;
    points.push({
      t: new Date(start + index * effectiveStep).toISOString(),
      lat: 6.5 + Math.sin(index / 50) * 0.02 + progress * 0.25,
      lon: 3.4 + Math.cos(index / 70) * 0.02 + progress * 0.25,
      speed_kph: 35 + Math.round(Math.abs(Math.sin(index / 40)) * 45),
      heading_deg: (index * 7) % 360,
    });
  }

  if (vehicleId === GAP_VEHICLE_ID && points.length > 6) {
    const gapStart = Math.floor(points.length * 0.4);
    const gapEnd = Math.floor(points.length * 0.6);
    return points.filter((_, index) => index < gapStart || index >= gapEnd);
  }
  return points;
}

export const historyFixture: Point[] = [
  { t: "2026-11-02T18:00:00Z", lat: 6.45, lon: 3.39, speed_kph: 42, heading_deg: 92 },
  { t: "2026-11-02T18:00:30Z", lat: 6.4504, lon: 3.3912, speed_kph: 48, heading_deg: 94 },
  { t: "2026-11-02T18:01:00Z", lat: 6.4509, lon: 3.3924, speed_kph: 53, heading_deg: 95 },
  { t: "2026-11-02T18:01:30Z", lat: 6.4513, lon: 3.3939, speed_kph: 57, heading_deg: 96 },
  { t: "2026-11-02T18:02:00Z", lat: 6.4518, lon: 3.3954, speed_kph: 61, heading_deg: 97 },
];

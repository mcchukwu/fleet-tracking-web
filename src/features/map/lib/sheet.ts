import { SHEET_PEEK } from "./constants";

export type SheetSnap = "peek" | "half" | "full";

export const TOP_BAR_HEIGHT = 48;
export const SHEET_STRIP = 80;

export interface SheetMetrics {
  available: number;
  peek: number;
  half: number;
  full: number;
}

export function sheetMetricsFromAvailable(
  availableHeight: number,
  strip = SHEET_STRIP,
  peek = SHEET_PEEK,
): SheetMetrics {
  const full = Math.max(peek, availableHeight - strip);
  return {
    available: full,
    peek,
    half: Math.max(peek, Math.round(full / 2)),
    full,
  };
}

export function sheetMetrics(
  viewportHeight: number,
  topBar = TOP_BAR_HEIGHT,
  strip = SHEET_STRIP,
  peek = SHEET_PEEK,
): SheetMetrics {
  return sheetMetricsFromAvailable(viewportHeight - topBar, strip, peek);
}

export function sheetVisible(snap: SheetSnap, metrics: SheetMetrics): number {
  if (snap === "peek") return metrics.peek;
  if (snap === "half") return metrics.half;
  return metrics.full;
}

export function clampVisible(visible: number, metrics: SheetMetrics): number {
  return Math.min(metrics.full, Math.max(metrics.peek, visible));
}

export function nearestSnap(visible: number, metrics: SheetMetrics): SheetSnap {
  const candidates: Array<[SheetSnap, number]> = [
    ["peek", metrics.peek],
    ["half", metrics.half],
    ["full", metrics.full],
  ];
  return candidates.reduce((closest, current) =>
    Math.abs(current[1] - visible) < Math.abs(closest[1] - visible)
      ? current
      : closest,
  )[0];
}

export function isObscured(visible: number, metrics: SheetMetrics): boolean {
  return visible / metrics.full > 0.6;
}

const SNAPS: readonly SheetSnap[] = ["peek", "half", "full"];

export function nextSheetSnap(snap: SheetSnap, direction: 1 | -1): SheetSnap {
  const index = SNAPS.indexOf(snap);
  const next = Math.min(SNAPS.length - 1, Math.max(0, index + direction));
  return SNAPS[next] ?? snap;
}

export function toggleSheetSnap(
  snap: SheetSnap,
  previous: Exclude<SheetSnap, "peek">,
): SheetSnap {
  return snap === "peek" ? previous : "peek";
}

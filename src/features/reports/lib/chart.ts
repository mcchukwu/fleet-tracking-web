import { alertTypeLabel } from "../../../lib/status";

export interface AlertTypeCount {
  key: string;
  count: number;
}

export interface ChartItem {
  key: string;
  label: string;
  count: number;
}

export type ChartState = "empty" | "missing" | "ready";

/** One visible row per positive count; server order is not contractual. */
export function chartItems(rows: readonly AlertTypeCount[]): ChartItem[] {
  return rows
    .filter((row) => row.count > 0)
    .map((row) => ({ key: row.key, label: alertTypeLabel(row.key), count: row.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function chartDescription(items: readonly ChartItem[]): string {
  if (items.length === 0) return "No alerts in this range.";
  const parts = items.map((item) => `${item.label} ${item.count}`);
  return `Alerts by type: ${parts.join(", ")}.`;
}

export function chartState(alertCount: number, items: readonly ChartItem[]): ChartState {
  if (items.length > 0) return "ready";
  return alertCount > 0 ? "missing" : "empty";
}

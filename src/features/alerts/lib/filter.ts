import type {
  Alert,
  AlertServerFilters,
  AlertSeverity,
  AlertStatus,
} from "../../../api/types";
import {
  alertTypeLabel,
  alertTypeOptions as knownAlertTypeOptions,
} from "../../../lib/status";

export interface AlertFilterValues {
  status: AlertStatus | null;
  type: string | null;
  severity: AlertSeverity | null;
  q: string;
}

export const emptyAlertFilters: AlertFilterValues = {
  status: null,
  type: null,
  severity: null,
  q: "",
};

/** Only status and type reach the API; severity and plate search are local. */
export function serverFilters(values: AlertFilterValues): AlertServerFilters {
  return {
    ...(values.status ? { status: values.status } : {}),
    ...(values.type ? { type: values.type } : {}),
  };
}

export function normalizePlateQuery(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]/g, "");
}

/** A change resets the scroll freeze and the pending set. */
export function filterSignature(values: AlertFilterValues): string {
  return [
    values.status ?? "",
    values.type ?? "",
    values.severity ?? "",
    normalizePlateQuery(values.q),
  ].join("|");
}

export function matchesClientFilters(alert: Alert, values: AlertFilterValues): boolean {
  if (values.severity !== null && alert.severity !== values.severity) return false;
  const query = normalizePlateQuery(values.q);
  if (query === "") return true;
  return normalizePlateQuery(alert.plate).includes(query);
}

export function sortNewestFirst(alerts: readonly Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    const first = Date.parse(a.occurred_at);
    const second = Date.parse(b.occurred_at);
    if (Number.isNaN(first)) return 1;
    if (Number.isNaN(second)) return -1;
    return second - first;
  });
}

export function filterAlerts(alerts: readonly Alert[], values: AlertFilterValues): Alert[] {
  return sortNewestFirst(alerts.filter((alert) => matchesClientFilters(alert, values)));
}

export interface AlertTypeOption {
  value: string;
  label: string;
}

/** Known types first, then any unknown type present in the loaded rows. */
export function alertTypeOptions(
  alerts: readonly Alert[],
  currentType: string | null,
): AlertTypeOption[] {
  const values = new Set<string>(knownAlertTypeOptions);
  for (const alert of alerts) values.add(alert.type);
  if (currentType) values.add(currentType);
  return [...values].map((value) => ({ value, label: alertTypeLabel(value) }));
}

export type AlertEmptyReason = "no-data" | "no-results" | "no-loaded-matches" | null;

export function emptyReason(input: {
  values: AlertFilterValues;
  serverCount: number;
  clientCount: number;
  hasMore: boolean;
}): AlertEmptyReason {
  if (input.clientCount > 0) return null;

  const filtered =
    input.values.status !== null ||
    input.values.type !== null ||
    input.values.severity !== null ||
    input.values.q.trim() !== "";

  if (input.serverCount === 0) return filtered ? "no-results" : "no-data";
  if (input.values.q.trim() !== "" || input.values.severity !== null) {
    return input.hasMore ? "no-loaded-matches" : "no-results";
  }
  return "no-results";
}

import { MISSING, formatNumber } from "./format";

/** A capped count is honest: 500 loaded rows may be the first page of more. */
export function openAlertCountLabel(count: number | undefined, limit: number): string {
  if (count === undefined) return MISSING;
  return count >= limit ? `${formatNumber(limit)}+` : formatNumber(count);
}

export type DatetimeField = "start" | "end" | "both";

export type DatetimeRangeValidation =
  | { valid: true; fromMs: number; toMs: number }
  | {
      valid: false;
      reason: "missing" | "invalid" | "order" | (string & {});
      message: string;
      /** Which field to mark and focus; absent means the dialog decides. */
      field?: DatetimeField;
    };

const missingMessage = "Choose a start and end time.";
const invalidMessage = "Enter a valid date and time.";
const orderMessage = "The end time must be after the start time.";

const rfc3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

/**
 * Strict RFC 3339: a date, a time and a zone. Date-only values are rejected
 * because the reports API silently replaces them with its own defaults.
 */
export function isRfc3339(value: string): boolean {
  const match = rfc3339.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const daysInMonth = new Date(Date.UTC(Number(year), monthNumber, 0)).getUTCDate();
  if (
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > daysInMonth ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  ) {
    return false;
  }
  if (offsetHour !== undefined && (Number(offsetHour) > 23 || Number(offsetMinute) > 59)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

export function validateDatetimeRange(
  from?: string | null,
  to?: string | null,
): DatetimeRangeValidation {
  if (!from || !to) {
    return {
      valid: false,
      reason: "missing",
      message: missingMessage,
      field: !from && !to ? "both" : from ? "end" : "start",
    };
  }
  if (!isRfc3339(from) || !isRfc3339(to)) {
    const badFrom = !isRfc3339(from);
    const badTo = !isRfc3339(to);
    return {
      valid: false,
      reason: "invalid",
      message: invalidMessage,
      field: badFrom && badTo ? "both" : badFrom ? "start" : "end",
    };
  }
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (toMs <= fromMs) {
    return {
      valid: false,
      reason: "order",
      message: orderMessage,
      field: "both",
    };
  }
  return { valid: true, fromMs, toMs };
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

export function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** A datetime-local value is local wall time; the API receives the UTC instant. */
export function fromLocalInputValue(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );
  // A DST gap or an impossible day rolls the clock forward; reject a value the
  // browser could not keep instead of sending a different instant than the one shown.
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hour) ||
    date.getMinutes() !== Number(minute)
  ) {
    return null;
  }
  return date.toISOString();
}

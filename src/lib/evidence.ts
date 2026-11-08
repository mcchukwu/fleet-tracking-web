export function humanizeEvidenceKey(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  if (!words) return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const UNIT_BY_KEY: Record<string, string> = {
  distance_m: "m",
  speed_kph: "km/h",
  limit_kph: "km/h",
  duration_s: "s",
  duration_min: "min",
};

/** Evidence is free-form; every value becomes text, never markup. */
export function formatEvidenceValue(key: string, value: unknown): string {
  const unit = UNIT_BY_KEY[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return unit ? `${value} ${unit}` : String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null) return "—";
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return "—";
}

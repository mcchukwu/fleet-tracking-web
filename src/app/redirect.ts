export function safeRedirect(value: string | undefined, fallback = "/map"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

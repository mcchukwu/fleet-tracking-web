const BASE_TITLE = "Fleet Console";

export function formatDocumentTitle(title?: string, openAlerts?: number): string {
  if (!title) return BASE_TITLE;
  const prefix = openAlerts && openAlerts > 0 ? `(${openAlerts}) ` : "";
  return `${prefix}${title} · ${BASE_TITLE}`;
}

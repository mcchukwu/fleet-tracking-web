const BASE_TITLE = "Fleet Console";

export function formatDocumentTitle(title?: string, openAlerts?: number | string): string {
  if (!title) return BASE_TITLE;
  const prefix =
    openAlerts !== undefined && openAlerts !== 0 && openAlerts !== "" && openAlerts !== "0"
      ? `(${openAlerts}) `
      : "";
  return `${prefix}${title} · ${BASE_TITLE}`;
}

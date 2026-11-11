const objectUrlLifetimeMs = 1_000;

export function downloadText(
  fileName: string,
  text: string,
  mimeType = "text/csv;charset=utf-8",
): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), objectUrlLifetimeMs);
}

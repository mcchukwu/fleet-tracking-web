/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- the horizontally scrollable header row must be keyboard reachable */
import { Download } from "lucide-react";
import { Button } from "../../../ui/Button";
import { CopyButton } from "../../../ui/CopyButton";
import { importHeaderRow } from "../lib/csv";
import type { ImportPreview } from "../lib/preview";

export interface ImportExpectedHeadersProps {
  preview: ImportPreview | null;
  onDownloadSample: () => void;
  disabledReason?: string;
}

function headerWarning(preview: ImportPreview): string | null {
  const parts: string[] = [];
  if (preview.unknownHeaders.length > 0) {
    const shown = preview.unknownHeaders.slice(0, 5);
    const rest = preview.unknownHeaders.length - shown.length;
    parts.push(
      `Unknown ${preview.unknownHeaders.length === 1 ? "column" : "columns"}: ${shown.join(", ")}${rest > 0 ? ` and ${rest} more` : ""}. These are ignored.`,
    );
  }
  if (preview.duplicateHeaders.length > 0) {
    parts.push(
      `Duplicate ${preview.duplicateHeaders.length === 1 ? "column" : "columns"}: ${preview.duplicateHeaders.join(", ")}. The server decides which wins.`,
    );
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

export function ImportExpectedHeaders({
  preview,
  onDownloadSample,
  disabledReason,
}: ImportExpectedHeadersProps) {
  const warning = preview ? headerWarning(preview) : null;
  const header = importHeaderRow();

  return (
    <section
      aria-labelledby="import-headers-title"
      data-testid="import-expected-headers"
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="import-headers-title" className="text-text text-sm font-medium">
          Expected columns
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton
            value={header}
            label="Header row"
            ariaLabel="Copy header row"
            appearance="button"
          >
            Copy header row
          </CopyButton>
          <Button
            size="sm"
            leadingIcon={<Download aria-hidden="true" className="size-3" strokeWidth={1.5} />}
            onClick={onDownloadSample}
            disabledReason={disabledReason}
          >
            Download sample CSV
          </Button>
        </div>
      </div>
      <code
        data-testid="import-header-row"
        tabIndex={0}
        aria-label="Expected column names"
        className="border-border bg-surface-2 text-muted min-h-touch block overflow-x-auto rounded-md border px-3 py-2 font-mono text-xs whitespace-nowrap md:min-h-0"
      >
        {header}
      </code>
      {warning ? (
        <p className="text-warning text-xs" data-testid="import-header-warning">
          {warning}
        </p>
      ) : null}
    </section>
  );
}

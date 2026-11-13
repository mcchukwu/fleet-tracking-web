import { TriangleAlert } from "lucide-react";
import type { Ref } from "react";
import { MISSING } from "../../../lib/format";
import { useDelayedFlag } from "../../../lib/useDelayedFlag";
import { CopyButton } from "../../../ui/CopyButton";
import { DataTable, type DataTableColumn } from "../../../ui/DataTable";
import { Skeleton } from "../../../ui/StatePanel";
import type { ImportCopy } from "../lib/copy";
import type { ImportPreview as Preview } from "../lib/preview";

export type ImportPreviewState = "idle" | "loading" | "empty" | "error" | "ready";

export interface ImportPreviewProps {
  preview: Preview | null;
  state: ImportPreviewState;
  error?: ImportCopy | null;
  errorRef?: Ref<HTMLDivElement>;
}

const identifiers: Record<string, string> = {
  imei: "IMEI",
  plate: "Plate",
  chassis_number: "Chassis number",
};

function previewColumns(preview: Preview): DataTableColumn<string[]>[] {
  return preview.headerRow.map((header, index) => {
    const normalised = preview.headers[index] ?? "";
    const label = identifiers[normalised];
    return {
      id: `${index}:${normalised || header}`,
      header: <span title={header}>{header || MISSING}</span>,
      width: index === 0 ? 180 : 150,
      truncate: label === undefined,
      cell: (row) => {
        const value = row[index] ?? "";
        if (value === "") return MISSING;
        if (label) {
          return (
            <CopyButton inline value={value} label={label}>
              {value}
            </CopyButton>
          );
        }
        return value;
      },
    };
  });
}

function PreviewSkeleton() {
  return (
    <div
      data-testid="import-preview-loading"
      aria-busy="true"
      aria-label="Reading file"
      className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4"
    >
      <Skeleton className="w-32" />
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="w-28" />
          <Skeleton className="w-24" />
          <Skeleton className="w-20" />
          <Skeleton className="ml-auto w-12" />
        </div>
      ))}
    </div>
  );
}

export function ImportPreview({ preview, state, error = null, errorRef }: ImportPreviewProps) {
  const showSkeleton = useDelayedFlag(state === "loading");

  if (state === "idle") return null;

  if (state === "error") {
    return (
      <div
        ref={errorRef}
        tabIndex={-1}
        role="alert"
        data-testid="import-preview-error"
        className="text-danger border-border-strong bg-surface flex items-start gap-2 rounded-md border p-3 text-sm outline-none"
      >
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
        <div className="min-w-0">
          {error ? (
            <>
              <p className="font-medium">{error.title}</p>
              <p>{error.detail}</p>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <p className="text-muted text-sm" data-testid="import-preview-empty">
        This file has no data rows.
      </p>
    );
  }

  if (state === "loading") {
    return showSkeleton ? <PreviewSkeleton /> : null;
  }

  if (!preview) return null;

  return (
    <section
      aria-labelledby="import-preview-title"
      data-testid="import-preview"
      className="flex flex-col gap-2"
    >
      <h2 id="import-preview-title" className="text-text text-sm font-medium">
        First 5 rows
      </h2>
      <DataTable
        columns={previewColumns(preview)}
        rows={preview.rows}
        rowKey={(_row, index) => String(index)}
        label="CSV preview"
        className="max-h-72"
      />
    </section>
  );
}

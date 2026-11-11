import { Download } from "lucide-react";
import { formatCount } from "../../../lib/format";
import { Button } from "../../../ui/Button";
import { DataTable, type DataTableColumn } from "../../../ui/DataTable";
import type { ImportResult } from "../../../api/types";

type ImportRowError = NonNullable<ImportResult["errors"]>[number];

export interface ImportErrorTableProps {
  errors: readonly ImportRowError[];
  failed: number;
  onDownload: () => void;
}

const columns: DataTableColumn<ImportRowError>[] = [
  {
    id: "row",
    header: "Row",
    width: 80,
    align: "right",
    cell: (error) => formatCount(error.row),
  },
  {
    id: "message",
    header: "Message",
    width: 520,
    title: (error) => error.message,
    cell: (error) => error.message,
  },
];

export function ImportErrorTable({
  errors,
  failed,
  onDownload,
}: ImportErrorTableProps) {
  const capped = failed > errors.length;
  const notice = capped
    ? `Showing the first ${formatCount(errors.length)} of ${formatCount(failed)} row errors.`
    : `${formatCount(failed)} ${failed === 1 ? "row error" : "row errors"}.`;

  return (
    <section
      aria-label="Row errors"
      data-testid="import-error-table"
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted text-sm" data-testid="import-error-notice">
          {notice}
        </p>
        <Button
          size="sm"
          leadingIcon={
            <Download aria-hidden="true" className="size-3" strokeWidth={1.5} />
          }
          onClick={onDownload}
        >
          Download errors as CSV
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={errors}
        rowKey={(error) => String(error.row)}
        label="Row errors"
        className="max-h-72"
      />
      <p className="text-subtle text-xs">Row numbers include the header line.</p>
    </section>
  );
}

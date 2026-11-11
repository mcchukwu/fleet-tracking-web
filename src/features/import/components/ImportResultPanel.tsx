import type { Ref } from "react";
import type { ImportResult } from "../../../api/types";
import { Button } from "../../../ui/Button";
import { Stat } from "../../../ui/Stat";
import { formatCount } from "../../../lib/format";
import { resultSentence } from "../lib/copy";
import { ImportErrorTable } from "./ImportErrorTable";

export interface ImportResultPanelProps {
  result: ImportResult;
  fileName: string;
  onSearchPlate: () => void;
  onImportAnother: () => void;
  onDownloadErrors: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}

export function ImportResultPanel({
  result,
  fileName,
  onSearchPlate,
  onImportAnother,
  onDownloadErrors,
  headingRef,
}: ImportResultPanelProps) {
  const errors = result.errors ?? [];

  return (
    <section
      aria-labelledby="import-result-title"
      data-testid="import-result"
      className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          ref={headingRef}
          id="import-result-title"
          tabIndex={-1}
          data-testid="import-result-heading"
          className="text-text text-base font-semibold outline-none"
        >
          Import complete
        </h2>
        <p className="text-muted truncate font-mono text-xs" title={fileName}>
          {fileName}
        </p>
      </div>

      <div className="border-border bg-border grid grid-cols-3 gap-px overflow-hidden rounded-md border">
        <div className="bg-surface">
          <Stat size="sm" label="Total rows" value={formatCount(result.total)} />
        </div>
        <div className="bg-surface">
          <Stat size="sm" label="Imported" value={formatCount(result.imported)} />
        </div>
        <div className="bg-surface">
          <Stat size="sm" label="Failed" value={formatCount(result.failed)} />
        </div>
      </div>

      <p className="text-text text-sm" data-testid="import-result-sentence">
        {resultSentence(result)}
      </p>

      {errors.length > 0 ? (
        <ImportErrorTable
          errors={errors}
          failed={result.failed}
          onDownload={onDownloadErrors}
        />
      ) : result.failed > 0 ? (
        <p className="text-muted text-sm">No row details were returned.</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={onSearchPlate}>
          Search a plate
        </Button>
        <Button onClick={onImportAnother}>Import another file</Button>
      </div>
    </section>
  );
}

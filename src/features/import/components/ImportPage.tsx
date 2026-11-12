import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { ImportResult } from "../../../api/types";
import { useCanMutate } from "../../../auth/useCanMutate";
import { Button } from "../../../ui/Button";
import { LoadingBar, ForbiddenState } from "../../../ui/StatePanel";
import { SlowNotice } from "../../../errors/SlowNotice";
import { FOCUS_SEARCH_EVENT } from "../../../lib/keyboard";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useConnection } from "../../../stores/connection";
import type { RecentImport } from "../../../lib/importHistory";
import { useImportPreview } from "../hooks/useImportPreview";
import { useImportUpload } from "../hooks/useImportUpload";
import { useRecentImports } from "../hooks/useRecentImports";
import { errorsCsv, errorsCsvFileName, sampleCsv, sampleCsvFileName } from "../lib/csv";
import { downloadText } from "../lib/download";
import { previewIssueCopy } from "../lib/copy";
import { ImportExpectedHeaders } from "./ImportExpectedHeaders";
import { ImportFailureNotice } from "./ImportFailureNotice";
import { ImportFilePicker } from "./ImportFilePicker";
import { ImportPreview } from "./ImportPreview";
import { ImportRecentList } from "./ImportRecentList";
import { ImportResultPanel } from "./ImportResultPanel";

/** Dev-only render-crash injection for the e2e fault matrix. */
const INJECT_CRASH =
  import.meta.env.DEV &&
  import.meta.env.VITE_MOCK === "1" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("crash") === "import";

interface ShownResult {
  result: ImportResult;
  fileName: string;
}

export function ImportPage() {
  if (INJECT_CRASH) throw new Error("Injected import crash");
  return <ImportPageContent />;
}

function ImportPageContent() {
  const navigate = useNavigate();
  const mutate = useCanMutate("mutate", "Your role can't import vehicles.");
  const canMutate = mutate.allowed;
  const { network } = useConnection();
  const offline = network === "offline";

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [shownResult, setShownResult] = useState<ShownResult | null>(null);
  const preview = useImportPreview(selectedFile);
  const upload = useImportUpload();
  const recent = useRecentImports();

  const chooseButtonRef = useRef<HTMLButtonElement>(null);
  const previewErrorRef = useRef<HTMLDivElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  useDocumentTitle("Import");

  useEffect(() => {
    if (preview.state === "error") previewErrorRef.current?.focus();
  }, [preview.state, preview.issue]);

  useEffect(() => {
    if (upload.error) failureRef.current?.focus();
  }, [upload.error]);

  function selectFile(file: File): void {
    setSelectedFile(file);
    setShownResult(null);
    upload.reset();
  }

  function clearFile(): void {
    setSelectedFile(null);
    setShownResult(null);
    upload.reset();
  }

  async function runUpload(): Promise<void> {
    const file = selectedFile;
    if (!file || preview.state !== "ready" || upload.pending) return;
    if (offline || !canMutate) return;

    setShownResult(null);
    const outcome = await upload.upload(file);
    if (outcome.status !== "success") return;

    const result = outcome.result;
    setShownResult({ result, fileName: file.name });
    await recent.add({
      jobId: result.job_id,
      fileName: file.name,
      completedAt: new Date().toISOString(),
      total: result.total,
      imported: result.imported,
      failed: result.failed,
      errors: result.errors,
    });
    window.setTimeout(() => resultHeadingRef.current?.focus(), 0);
  }

  function searchPlate(): void {
    void navigate({ to: "/map" }).then(() => {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
      }, 0);
    });
  }

  function importAnother(): void {
    clearFile();
    window.setTimeout(() => chooseButtonRef.current?.focus(), 0);
  }

  function viewRecent(entry: RecentImport): void {
    setShownResult({
      result: {
        job_id: entry.jobId,
        total: entry.total,
        imported: entry.imported,
        failed: entry.failed,
        errors: entry.errors,
      },
      fileName: entry.fileName,
    });
    window.setTimeout(() => resultHeadingRef.current?.focus(), 0);
  }

  function downloadErrors(result: ImportResult, fileName: string): void {
    downloadText(errorsCsvFileName(fileName), errorsCsv(result.errors ?? []));
  }

  const uploadReason =
    mutate.blockedBy === "role"
      ? "Your role can't import vehicles."
      : (mutate.reason ??
        (preview.state !== "ready" ? "Choose a valid .csv file first." : undefined));

  const statusText =
    upload.status === "uploading"
      ? "Uploading…"
      : upload.status === "cancelled"
        ? "Upload cancelled"
        : preview.state === "parsing"
          ? "Reading file…"
          : preview.state === "ready" && !shownResult
            ? "File ready to upload."
            : "";

  const result = shownResult;

  if (!mutate.roleAllowed) {
    return (
      <div
        data-testid="import-page"
        className="max-w-content text-text mx-auto flex w-full flex-col gap-4 px-4 py-6 sm:px-6"
      >
        <h1 className="text-lg font-semibold">Import</h1>
        <ForbiddenState
          action={
            <Link
              to="/map"
              className="text-accent-fg h-touch md:h-control-md inline-flex items-center text-sm font-medium underline-offset-4 hover:underline"
            >
              Back to the map
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div
      data-testid="import-page"
      className="max-w-content text-text mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Import</h1>
        <p className="text-muted max-w-prose text-sm">
          Add or update vehicles from a comma-separated file. Only{" "}
          <span className="font-mono text-xs">imei</span> is required, and
          re-uploading the same file is safe.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <div className="max-w-dialog flex w-full flex-col gap-4">
          <ImportFilePicker
            file={selectedFile}
            disabled={upload.pending}
            disabledReason="An upload is in progress."
            onSelect={selectFile}
            onClear={clearFile}
            chooseButtonRef={chooseButtonRef}
            emphasized={preview.state === "error"}
          />
          <ImportExpectedHeaders
            preview={preview.preview}
            onDownloadSample={() =>
              downloadText(sampleCsvFileName(), sampleCsv())
            }
          />
        </div>

        <ImportPreview
          preview={preview.preview}
          state={preview.state === "parsing" ? "loading" : preview.state}
          error={preview.issue ? previewIssueCopy(preview.issue) : null}
          errorRef={previewErrorRef}
        />

        <div className="max-w-dialog flex w-full flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={result ? "secondary" : "primary"}
              data-import-upload
              onClick={() => void runUpload()}
              loading={upload.pending}
              {...(uploadReason ? { disabledReason: uploadReason } : {})}
            >
              Upload file
            </Button>
            <output
              aria-live="polite"
              data-testid="import-status"
              className="text-muted text-sm"
            >
              {statusText}
            </output>
          </div>
          <div className="h-0.5">
            {upload.pending ? <LoadingBar label="Uploading vehicles" /> : null}
          </div>
          {upload.pending ? (
            <SlowNotice onCancel={upload.cancel} onRetry={upload.retry} />
          ) : null}
        </div>

        {upload.status === "error" && upload.error ? (
          <div className="max-w-dialog w-full">
            <ImportFailureNotice
              error={upload.error}
              fileName={selectedFile?.name ?? ""}
              onRetry={() => void runUpload()}
              onChooseAnother={() => chooseButtonRef.current?.click()}
              onBack={searchPlate}
              noticeRef={failureRef}
            />
          </div>
        ) : null}

        {result ? (
          <ImportResultPanel
            result={result.result}
            fileName={result.fileName}
            onSearchPlate={searchPlate}
            onImportAnother={importAnother}
            onDownloadErrors={() => downloadErrors(result.result, result.fileName)}
            headingRef={resultHeadingRef}
          />
        ) : null}
      </div>

      <ImportRecentList
        entries={recent.entries}
        state={recent.state}
        error={recent.error}
        onView={viewRecent}
        onRetry={() => void recent.retry()}
      />
    </div>
  );
}

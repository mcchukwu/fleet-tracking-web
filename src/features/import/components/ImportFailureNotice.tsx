import type { Ref } from "react";
import { InlineError } from "../../../errors/InlineError";
import type { AppError } from "../../../errors/types";
import { Button } from "../../../ui/Button";
import { importFailureCopy } from "../lib/copy";

export interface ImportFailureNoticeProps {
  error: AppError;
  fileName: string;
  onRetry: () => void;
  onChooseAnother: () => void;
  onBack: () => void;
  noticeRef?: Ref<HTMLDivElement>;
}

function canRetry(error: AppError): boolean {
  if (error.code === "invalid_request") return true;
  return ["network", "timeout", "server", "unavailable", "contract"].includes(
    error.kind,
  );
}

export function ImportFailureNotice({
  error,
  fileName,
  onRetry,
  onChooseAnother,
  onBack,
  noticeRef,
}: ImportFailureNoticeProps) {
  const copy = importFailureCopy(error);
  const forbidden = error.kind === "forbidden";
  const sessionExpired = error.kind === "unauthenticated";

  return (
    <div
      ref={noticeRef}
      tabIndex={-1}
      data-testid="import-failure"
      data-file={fileName}
      className="flex flex-col gap-3 rounded-md border border-border-strong bg-surface p-3 outline-none"
    >
      <InlineError
        error={error}
        copy={{ title: copy.title, detail: copy.detail }}
      />
      {forbidden ? (
        <div>
          <Button size="sm" onClick={onBack}>
            Back to the map
          </Button>
        </div>
      ) : sessionExpired ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {canRetry(error) ? (
            <Button
              size="sm"
              variant="primary"
              onClick={onRetry}
              data-import-retry
            >
              {error.outcome === "unknown" ? "Upload again" : "Retry"}
            </Button>
          ) : null}
          <Button size="sm" onClick={onChooseAnother}>
            Choose another file
          </Button>
        </div>
      )}
    </div>
  );
}

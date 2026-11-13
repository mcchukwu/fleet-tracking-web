import type { Ref } from "react";
import { InlineError } from "../../../errors/InlineError";
import type { AppError } from "../../../errors/types";
import { Button } from "../../../ui/Button";
import { useRetryCountdown } from "../hooks/useRetryCountdown";
import { importFailureCopy } from "../lib/copy";

export interface ImportFailureNoticeProps {
  error: AppError;
  fileName: string;
  onRetry: () => void;
  onChooseAnother: () => void;
  onBack: () => void;
  noticeRef?: Ref<HTMLDivElement>;
}

// CSRF failures are retried by the API client and surface as forbidden, and
// client errors come from rendering, so neither reaches an upload failure.
function canRetry(error: AppError): boolean {
  if (error.code === "invalid_request") return true;
  return ["network", "timeout", "server", "unavailable", "contract", "rate_limited"].includes(
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
  const remaining = useRetryCountdown(error);
  const copy = importFailureCopy(error, { remainingSec: remaining ?? undefined });
  const forbidden = error.kind === "forbidden";
  const sessionExpired = error.kind === "unauthenticated";

  return (
    <div
      ref={noticeRef}
      tabIndex={-1}
      data-testid="import-failure"
      data-file={fileName}
      className="border-border-strong bg-surface flex flex-col gap-3 rounded-md border p-3 outline-none"
    >
      <InlineError error={error} copy={{ title: copy.title, detail: copy.detail }} />
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
              {...(remaining !== null && remaining > 0
                ? { disabledReason: `Try again in ${remaining}s.` }
                : {})}
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

import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { errorCopy, copyDiagnosticsKinds, type ErrorCopy } from "./catalog";
import { diagnosticsJson, recordError } from "./report";
import { normalize } from "./normalize";
import { ClipboardError, type AppError } from "./types";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";

export interface InlineErrorProps {
  error: AppError;
  id?: string;
  onRetry?: () => void;
  showTitle?: boolean;
  copy?: Partial<Pick<ErrorCopy, "title" | "detail">>;
  className?: string;
}

export function InlineError({
  error,
  id,
  onRetry,
  showTitle = true,
  copy,
  className,
}: InlineErrorProps) {
  const resolved = errorCopy(error);
  const title = copy?.title ?? resolved.title;
  const detail = copy?.detail ?? resolved.detail;
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyDiagnostics(): Promise<void> {
    try {
      await navigator.clipboard.writeText(diagnosticsJson());
      setCopyStatus("copied");
    } catch (cause) {
      recordError(
        normalize(new ClipboardError(undefined, { cause }), {
          route: error.context.route,
          action: "copy diagnostics",
        }),
      );
      setCopyStatus("failed");
    }
  }

  return (
    <div
      id={id}
      role="alert"
      className={cn("flex flex-col gap-1 text-sm text-danger", className)}
    >
      <div className="flex items-start gap-2">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
        <p className="min-w-0 flex-1">
          {showTitle && title ? <span className="font-medium">{title} </span> : null}
          {detail}
        </p>
        {resolved.action === "retry" && onRetry ? (
          <Button size="sm" variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
      {copyDiagnosticsKinds.has(error.kind) ? (
        <div className="flex items-center gap-2 pl-6">
          <Button size="sm" variant="ghost" onClick={() => void copyDiagnostics()}>
            Copy diagnostics
          </Button>
          {copyStatus !== "idle" ? (
            <output className="text-xs text-muted">
              {copyStatus === "copied"
                ? "Copied"
                : "Couldn't copy. Select the text and press Ctrl+C."}
            </output>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

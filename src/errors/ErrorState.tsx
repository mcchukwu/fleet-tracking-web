import { useState } from "react";
import {
  Ban,
  Clock,
  FileQuestion,
  Map,
  RefreshCw,
  ServerCrash,
  TriangleAlert,
  WifiOff,
  WifiOff as WifiOffIcon,
} from "lucide-react";
import { errorCopy, copyDiagnosticsKinds, type ErrorAction } from "./catalog";
import { normalize } from "./normalize";
import { diagnosticsJson, recordError } from "./report";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";
import { ClipboardError, type AppError, type AppErrorKind } from "./types";

const icons: Partial<Record<AppErrorKind, typeof TriangleAlert>> = {
  offline: WifiOff,
  network: WifiOffIcon,
  timeout: Clock,
  unauthenticated: Ban,
  forbidden: Ban,
  not_found: FileQuestion,
  server: ServerCrash,
  unavailable: RefreshCw,
  map: Map,
};

const actionLabels: Record<Exclude<ErrorAction, "none">, string> = {
  retry: "Retry",
  refresh: "Refresh",
  sign_in: "Sign in",
  go_back: "Go back",
  reload: "Reload",
  dismiss: "Dismiss",
};

export interface ErrorStateProps {
  error: AppError;
  onRetry?: () => void;
  onAction?: () => void;
  compact?: boolean;
  blocking?: boolean;
  className?: string;
}

export function ErrorState({
  error,
  onRetry,
  onAction,
  compact = false,
  blocking = false,
  className,
}: ErrorStateProps) {
  const copy = errorCopy(error);
  const Icon = icons[error.kind] ?? TriangleAlert;
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const actionHandler =
    copy.action === "retry"
      ? onRetry
      : copy.action === "reload" || copy.action === "refresh"
        ? (onAction ?? (() => window.location.reload()))
        : copy.action === "go_back"
          ? (onAction ?? (() => window.history.back()))
          : onAction;

  async function copyDiagnostics() {
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

  if (compact) {
    return (
      <div
        role={blocking ? "alert" : "status"}
        className={cn("flex items-center gap-2 px-3 py-2", className)}
      >
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-danger" strokeWidth={1.5} />
        <p className="min-w-0 flex-1 truncate text-sm text-text">Couldn't load</p>
        {actionHandler ? (
          <Button size="sm" variant="ghost" onClick={actionHandler}>
            {actionLabels[copy.action === "none" ? "retry" : copy.action]}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role={blocking ? "alert" : "status"}
      className={cn("flex flex-col items-center gap-2 px-4 py-10 text-center", className)}
    >
      <Icon aria-hidden="true" className="size-6 text-danger" strokeWidth={1.5} />
      <p className="text-base font-medium text-text">{copy.title}</p>
      <p className="max-w-prose text-sm text-muted">{copy.detail}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {actionHandler ? (
          <Button size="sm" onClick={actionHandler}>
            {actionLabels[copy.action === "none" ? "retry" : copy.action]}
          </Button>
        ) : null}
        {copyDiagnosticsKinds.has(error.kind) ? (
          <Button size="sm" variant="ghost" onClick={() => void copyDiagnostics()}>
            Copy diagnostics
          </Button>
        ) : null}
      </div>
      {copyStatus !== "idle" ? (
        <output className="text-xs text-muted">
          {copyStatus === "copied" ? "Copied" : "Couldn't copy. Select the text and press Ctrl+C."}
        </output>
      ) : null}
    </div>
  );
}

import { TriangleAlert } from "lucide-react";
import { errorCopy } from "./catalog";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";
import type { AppError } from "./types";

export interface InlineErrorProps {
  error: AppError;
  id?: string;
  onRetry?: () => void;
  showTitle?: boolean;
  className?: string;
}

export function InlineError({
  error,
  id,
  onRetry,
  showTitle = true,
  className,
}: InlineErrorProps) {
  const copy = errorCopy(error);

  return (
    <div
      id={id}
      role="alert"
      className={cn("flex items-start gap-2 text-sm text-danger", className)}
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
      <p className="min-w-0 flex-1">
        {showTitle ? <span className="font-medium">{copy.title}. </span> : null}
        {copy.detail}
      </p>
      {copy.action === "retry" && onRetry ? (
        <Button size="sm" variant="ghost" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

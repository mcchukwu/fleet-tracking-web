import { useState } from "react";
import { errorCopy } from "../errors/catalog";
import { normalize } from "../errors/normalize";
import { recordError } from "../errors/report";
import { ClipboardError } from "../errors/types";
import { cn } from "./cn";
import { useToast } from "./Toast";

export interface CopyButtonProps {
  value: string;
  label: string;
  className?: string;
  inline?: boolean;
  appearance?: "inline" | "button";
  /** Short accessible name when the visible value is a long row. */
  ariaLabel?: string;
  children?: React.ReactNode;
}

async function writeToClipboard(value: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new ClipboardError("The clipboard is unavailable");
  }
  try {
    await navigator.clipboard.writeText(value);
  } catch (cause) {
    throw new ClipboardError(undefined, { cause });
  }
}

export function CopyButton({
  value,
  label,
  className,
  inline = false,
  appearance = "inline",
  ariaLabel,
  children,
}: CopyButtonProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const accessibleName = ariaLabel ?? `Copy ${label.toLowerCase()} ${value}`;

  async function copy(): Promise<void> {
    try {
      await writeToClipboard(value);
      setStatus("copied");
      toast({ title: `${label} copied`, tone: "success", key: `copy:${label}:${value}` });
    } catch (cause) {
      const error = normalize(cause, { action: "copy", resource: label });
      recordError(error);
      const copy = errorCopy(error);
      setStatus("failed");
      toast({
        title: copy.title,
        description: copy.detail,
        tone: "error",
        key: `copy:${label}:${value}`,
      });
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={accessibleName}
      title={ariaLabel ?? `Copy ${label.toLowerCase()}`}
      data-copy-status={status}
      className={cn(
        "min-w-touch focus-visible:outline-focus-ring inline-flex items-center justify-start text-sm underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-0 md:min-w-0",
        appearance === "button"
          ? "border-border-strong bg-surface text-text hover:bg-surface-2 h-touch md:h-control-md rounded-md border px-3 font-medium hover:no-underline"
          : // The inline variant keeps a 24px visual line inside a 56px row but must
            // still offer a 44px touch target, so it grows symmetrically and the
            // negative margins keep its layout contribution at one text line.
            cn(
              "text-text hover:underline",
              "rounded-sm font-mono",
              inline ? "h-touch md:h-control-sm -my-3 md:my-0" : "h-touch md:h-control-sm",
            ),
        className,
      )}
    >
      {children ?? value}
    </button>
  );
}

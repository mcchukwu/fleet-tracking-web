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

export function CopyButton({ value, label, className, children }: CopyButtonProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

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
      aria-label={`Copy ${label.toLowerCase()} ${value}`}
      title={`Copy ${label.toLowerCase()}`}
      data-copy-status={status}
      className={cn(
        "rounded-sm font-mono text-sm text-text underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring",
        className,
      )}
    >
      {children ?? value}
    </button>
  );
}

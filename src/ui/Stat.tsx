import type { ReactNode } from "react";
import { cn } from "./cn";

export interface StatProps {
  label: string;
  value: string | number;
  hint?: string;
  size?: "md" | "sm";
  /** A status dot or similar sits before the label without changing the value. */
  leading?: ReactNode;
  className?: string;
}

export function Stat({
  label,
  value,
  hint,
  size = "md",
  leading,
  className,
}: StatProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-l border-border first:border-l-0",
        size === "md" ? "px-4 py-4" : "px-3 py-2",
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
        <span className="label-caps text-muted">{label}</span>
      </span>
      <span className={cn("tabular-nums text-text", size === "md" ? "text-stat" : "text-lg font-medium")}>
        {value}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

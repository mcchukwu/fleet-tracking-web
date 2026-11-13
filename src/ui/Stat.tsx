import type { ReactNode } from "react";
import { cn } from "./cn";
import { Tooltip } from "./Tooltip";

export interface StatProps {
  label: string;
  value: string | number;
  hint?: string;
  /** Local and UTC reading for a relative hint such as an age. */
  hintTooltip?: string;
  size?: "md" | "sm";
  /** A status dot or similar sits before the label without changing the value. */
  leading?: ReactNode;
  className?: string;
}

export function Stat({
  label,
  value,
  hint,
  hintTooltip,
  size = "md",
  leading,
  className,
}: StatProps) {
  return (
    <div
      className={cn(
        "border-border flex flex-col gap-1 border-l first:border-l-0",
        size === "md" ? "px-4 py-4" : "px-3 py-2",
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
        <span className="label-caps text-muted">{label}</span>
      </span>
      <span
        className={cn(
          "text-text tabular-nums",
          size === "md" ? "text-stat" : "text-lg font-medium",
        )}
      >
        {value}
      </span>
      {hint ? (
        hintTooltip ? (
          <Tooltip label={hintTooltip}>
            <button
              type="button"
              className="text-muted h-touch min-w-touch focus-visible:outline-focus-ring pointer-events-auto -my-3 inline-flex items-center justify-center rounded-sm text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-offset-0 md:my-0 md:h-auto md:min-w-0"
            >
              {hint}
            </button>
          </Tooltip>
        ) : (
          <span className="text-muted text-xs tabular-nums">{hint}</span>
        )
      ) : null}
    </div>
  );
}

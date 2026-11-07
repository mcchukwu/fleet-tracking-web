import type { ReactNode } from "react";
import { useFlashOnChange } from "../hooks/useFlashOnChange";
import { cn } from "../../../ui/cn";

export interface LiveValueProps {
  value: unknown;
  children: ReactNode;
  className?: string;
}

/** Restarts the 600ms accent tint when the value changes; disabled by reduced motion. */
export function LiveValue({ value, children, className }: LiveValueProps) {
  const flashKey = useFlashOnChange(value);
  return (
    <span
      key={flashKey}
      className={cn(
        "inline-flex min-w-0 items-center rounded-sm",
        flashKey > 0 ? "value-flash" : undefined,
        className,
      )}
    >
      {children}
    </span>
  );
}

import { ChevronDown, CircleAlert } from "lucide-react";
import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  /** `above` keeps the label visible as a form label; `inline` names the control without stacking a line above it. */
  labelPlacement?: "above" | "inline";
  /** Tighter horizontal padding and chevron, for crowded control bars. */
  compact?: boolean;
  hint?: string;
  error?: string;
}

export function Select({
  className,
  label,
  labelPlacement = "above",
  compact = false,
  hint,
  error,
  children,
  ...props
}: SelectProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const inline = labelPlacement === "inline";
  return (
    <div className={inline ? "flex" : "flex flex-col gap-1"}>
      <label htmlFor={id} className={inline ? "sr-only" : "text-text text-sm font-medium"}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-touch bg-surface text-text focus-visible:ring-focus-ring/30 md:h-control-md w-full appearance-none rounded-md border text-base transition-colors duration-100 focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset",
            compact ? "pr-4 pl-2 md:px-4 md:pr-10" : "px-4 pr-10",
            error
              ? "border-danger focus-visible:border-danger"
              : "border-border-strong focus-visible:border-accent",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "text-subtle pointer-events-none absolute top-1/2 -translate-y-1/2",
            compact ? "right-1 size-3 md:right-3 md:size-4" : "right-3 size-4",
          )}
          strokeWidth={1.5}
        />
      </div>
      {hint ? (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-danger flex items-center gap-1 text-xs">
          <CircleAlert aria-hidden="true" className="size-3" strokeWidth={1.5} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

import { ChevronDown, CircleAlert } from "lucide-react";
import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  hint?: string;
  error?: string;
}

export function Select({ className, label, hint, error, children, ...props }: SelectProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-touch w-full appearance-none rounded-md border bg-surface px-4 pr-10 text-base text-text transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus-ring/30 md:h-control-md",
            error
              ? "border-danger focus-visible:border-danger"
              : "border-border-strong focus-visible:border-accent",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-2 size-4 text-subtle" strokeWidth={1.5} />
      </div>
      {hint ? <p id={hintId} className="text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-xs text-danger">
          <CircleAlert aria-hidden="true" className="size-3" strokeWidth={1.5} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

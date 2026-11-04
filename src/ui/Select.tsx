import { ChevronDown } from "lucide-react";
import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  hint?: string;
}

export function Select({ className, label, hint, children, ...props }: SelectProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-describedby={hintId}
          className={cn(
            "h-touch w-full appearance-none rounded-md border border-border-strong bg-surface px-4 pr-10 text-base text-text transition-colors duration-100 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus-ring/30 md:h-control-md",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-2 size-4 text-subtle" strokeWidth={1.5} />
      </div>
      {hint ? <p id={hintId} className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

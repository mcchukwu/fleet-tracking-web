import { CircleAlert } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "./cn";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  className,
  label,
  hint,
  error,
  leadingIcon,
  trailing,
  ref,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = props.name ? `${props.name}-${generatedId}` : generatedId;
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <div className="relative">
        {leadingIcon ? (
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-subtle">
            {leadingIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-touch w-full rounded-md border bg-surface px-4 md:h-control-md text-base text-text transition-colors duration-100 placeholder:text-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus-ring/30 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted",
            leadingIcon ? "pl-10" : "",
            trailing ? "pr-14" : "",
            error ? "border-danger focus-visible:border-danger" : "border-border-strong focus-visible:border-accent",
            className,
          )}
          {...props}
        />
        {trailing ? <span className="absolute inset-y-0 right-3 flex items-center gap-1">{trailing}</span> : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1 text-xs text-danger">
          <CircleAlert aria-hidden="true" className="size-3" strokeWidth={1.5} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

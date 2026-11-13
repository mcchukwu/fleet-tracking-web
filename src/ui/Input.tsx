import { CircleAlert } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "./cn";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  /** The compact map sheet keeps the accessible name but hides the visible label. */
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  className,
  label,
  hideLabel = false,
  hint,
  error,
  leadingIcon,
  trailing,
  ref,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = props.name ? `${props.name}-${generatedId}` : generatedId;
  const describedBy =
    [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-text text-sm font-medium"}>
        {label}
      </label>
      <div className="relative">
        {leadingIcon ? (
          <span
            aria-hidden="true"
            className="text-subtle pointer-events-none absolute inset-y-0 left-4 flex items-center"
          >
            {leadingIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-touch bg-surface md:h-control-md text-text placeholder:text-subtle focus-visible:ring-focus-ring/30 disabled:bg-surface-2 disabled:text-muted w-full rounded-md border px-4 text-base transition-colors duration-100 focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed",
            leadingIcon ? "pl-10" : "",
            trailing ? "pr-search-trailing" : "",
            error
              ? "border-danger focus-visible:border-danger"
              : "border-border-strong focus-visible:border-accent",
            className,
          )}
          {...props}
        />
        {trailing ? (
          <span className="absolute inset-y-0 right-3 flex items-center gap-1">{trailing}</span>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-muted text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-danger flex items-center gap-1 text-xs">
          <CircleAlert aria-hidden="true" className="size-3" strokeWidth={1.5} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

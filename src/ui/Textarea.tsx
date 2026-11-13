import { CircleAlert } from "lucide-react";
import { useId, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  hint?: string;
  error?: string;
}

export function Textarea({ className, label, hint, error, ...props }: TextareaProps) {
  const id = useId();
  const describedBy =
    [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-text text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "bg-surface text-text placeholder:text-subtle focus-visible:ring-focus-ring/30 min-h-24 w-full resize-none rounded-md border px-4 py-3 text-base transition-colors duration-100 focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset",
          error
            ? "border-danger focus-visible:border-danger"
            : "border-border-strong focus-visible:border-accent",
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-muted text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-danger flex items-center gap-1 text-xs">
          <CircleAlert aria-hidden="true" className="size-3" strokeWidth={1.5} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

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
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-24 w-full resize-none rounded-md border bg-surface px-4 py-3 text-base text-text transition-colors duration-100 placeholder:text-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus-ring/30",
          error ? "border-danger focus-visible:border-danger" : "border-border-strong focus-visible:border-accent",
          className,
        )}
        {...props}
      />
      {hint ? <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1 text-xs text-danger">
          <CircleAlert aria-hidden="true" className="size-3" strokeWidth={1.5} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

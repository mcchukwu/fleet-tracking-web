import { Check } from "lucide-react";
import { useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> {
  label: string;
}

export function Checkbox({ className, label, ...props }: CheckboxProps) {
  const id = useId();
  return (
    <label htmlFor={id} className="inline-flex h-touch items-center gap-2 text-sm text-text has-[:disabled]:opacity-50 md:h-control-sm">
      <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          className={cn(
            "peer size-4 appearance-none rounded-sm border border-border-strong bg-surface transition-colors duration-100 checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring disabled:cursor-not-allowed",
            className,
          )}
          {...props}
        />
        <Check
          aria-hidden="true"
          className="pointer-events-none absolute size-3 text-text-inverse opacity-0 transition-opacity duration-100 peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
      {label}
    </label>
  );
}

import { Check } from "lucide-react";
import { useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> {
  label: string;
}

export function Checkbox({ className, label, ...props }: CheckboxProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="h-touch text-text md:h-control-sm inline-flex items-center gap-2 text-sm has-[:disabled]:opacity-50"
    >
      <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          className={cn(
            "peer border-border-strong bg-surface checked:border-accent checked:bg-accent focus-visible:outline-focus-ring size-4 appearance-none rounded-sm border transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-0 disabled:cursor-not-allowed",
            className,
          )}
          {...props}
        />
        <Check
          aria-hidden="true"
          className="text-accent-contrast pointer-events-none absolute size-3 opacity-0 transition-opacity duration-100 peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
      {label}
    </label>
  );
}

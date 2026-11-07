import { Check } from "lucide-react";
import { cn } from "../ui/cn";
import { ACCENTS } from "./accents";
import { useTheme } from "./theme-context";

export function AccentPicker() {
  const { accent, setAccent } = useTheme();

  return (
    <fieldset aria-label="Accent colour" className="m-0 inline-flex items-center gap-1 border-0 p-0">
      {ACCENTS.map((option) => {
        const active = accent === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-label={option.label}
            aria-pressed={active}
            title={option.label}
            onClick={() => setAccent(option.id)}
            className={cn(
              "inline-flex size-control-sm items-center justify-center rounded-full transition-shadow duration-100",
              active ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "hover:ring-2 hover:ring-border-strong",
            )}
          >
            <span className={cn("inline-flex size-4 items-center justify-center rounded-full", option.swatch)}>
              {active ? (
                <Check aria-hidden="true" className="size-3 text-accent-contrast" strokeWidth={3} />
              ) : null}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}

import { Check } from "lucide-react";
import { cn } from "../ui/cn";
import { ACCENTS } from "./accents";
import { useTheme } from "./theme-context";

export function AccentPicker() {
  const { accent, setAccent } = useTheme();

  return (
    <fieldset
      aria-label="Accent colour"
      className="m-0 inline-flex items-center gap-1 border-0 p-0"
    >
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
              "size-control-sm inline-flex items-center justify-center rounded-full transition-shadow duration-100",
              active
                ? "ring-accent ring-offset-surface ring-2 ring-offset-2"
                : "hover:ring-border-strong hover:ring-2",
            )}
          >
            <span
              className={cn(
                "inline-flex size-4 items-center justify-center rounded-full",
                option.swatch,
              )}
            >
              {active ? (
                <Check aria-hidden="true" className="text-accent-contrast size-3" strokeWidth={3} />
              ) : null}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}

import { Check } from "lucide-react";
import { cn } from "../ui/cn";
import { useTheme, type Accent } from "./theme-context";

const accents: Array<{ id: Accent; label: string; swatch: string }> = [
  { id: "blue", label: "Blue accent", swatch: "swatch-blue" },
  { id: "violet", label: "Violet accent", swatch: "swatch-violet" },
  { id: "teal", label: "Teal accent", swatch: "swatch-teal" },
];

export function AccentPicker() {
  const { accent, setAccent } = useTheme();

  return (
    <fieldset aria-label="Accent colour" className="m-0 inline-flex items-center gap-1 border-0 p-0">
      {accents.map((option) => {
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
              {active ? <Check aria-hidden="true" className="size-3 text-text-inverse" strokeWidth={2} /> : null}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "../ui/cn";
import { useTheme, type ThemeMode } from "./theme-context";

const options: Array<{ mode: ThemeMode; label: string; Icon: typeof Sun }> = [
  { mode: "light", label: "Light theme", Icon: Sun },
  { mode: "dark", label: "Dark theme", Icon: Moon },
  { mode: "system", label: "System theme", Icon: Monitor },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <fieldset
      aria-label="Colour theme"
      className="h-control-md border-border bg-surface m-0 inline-flex items-center rounded-md border"
    >
      {options.map(({ mode: value, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => setMode(value)}
            className={cn(
              "inline-flex h-full w-8 items-center justify-center rounded-sm transition-colors duration-100",
              active
                ? "bg-accent-soft text-accent-fg"
                : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
          </button>
        );
      })}
    </fieldset>
  );
}

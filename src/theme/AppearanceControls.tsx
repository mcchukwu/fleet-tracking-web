import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "../ui/cn";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "../ui/DropdownMenu";
import { ACCENTS } from "./accents";
import { useTheme, type ThemeMode } from "./theme-context";

const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const keepOpen = (event: Event) => event.preventDefault();

export function AppearanceControls() {
  const { mode, setMode, accent, setAccent } = useTheme();

  return (
    <fieldset aria-label="Appearance" className="m-0 min-w-0 border-0 px-2 py-1">
      <DropdownMenuLabel className="px-0">Appearance</DropdownMenuLabel>

      <div className="mb-2 flex flex-col gap-1">
        <span className="text-muted text-xs">Theme</span>
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => {
            const next = themeOptions.find((option) => option.value === value);
            if (next) setMode(next.value);
          }}
          aria-label="Theme"
          className="flex gap-1"
        >
          {themeOptions.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              onSelect={keepOpen}
              className="flex-1 justify-center px-1"
            >
              <option.icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-muted text-xs">Accent</span>
        <DropdownMenuRadioGroup
          value={accent}
          onValueChange={(value) => {
            const next = ACCENTS.find((option) => option.id === value);
            if (next) setAccent(next.id);
          }}
          aria-label="Accent"
          className="flex gap-1"
        >
          {ACCENTS.map((option) => {
            const active = accent === option.id;
            return (
              <DropdownMenuRadioItem
                key={option.id}
                value={option.id}
                aria-label={option.label}
                showIndicator={false}
                onSelect={keepOpen}
                className="flex-1 justify-center px-1"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-4 items-center justify-center rounded-full",
                    option.swatch,
                  )}
                >
                  {active ? (
                    <Check
                      aria-hidden="true"
                      className="text-accent-contrast size-3"
                      strokeWidth={3}
                    />
                  ) : null}
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </div>
    </fieldset>
  );
}

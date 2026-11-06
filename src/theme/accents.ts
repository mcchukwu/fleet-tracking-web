import type { Accent } from "./theme-context";

export interface AccentOption {
  id: Accent;
  label: string;
  swatch: string;
}

/** One list feeds the picker, the appearance menu and the contrast test. */
export const ACCENTS: readonly AccentOption[] = [
  { id: "blue", label: "Blue accent", swatch: "swatch-blue" },
  { id: "violet", label: "Violet accent", swatch: "swatch-violet" },
  { id: "fuchsia", label: "Fuchsia accent", swatch: "swatch-fuchsia" },
  { id: "graphite", label: "Graphite accent", swatch: "swatch-graphite" },
];

export function isAccent(value: unknown): value is Accent {
  return ACCENTS.some((option) => option.id === value);
}

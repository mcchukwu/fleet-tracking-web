import { createContext, useContext } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type Accent = "blue" | "violet" | "teal";

export interface ThemeContextValue {
  mode: ThemeMode;
  resolved: "light" | "dark";
  accent: Accent;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: Accent) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return value;
}

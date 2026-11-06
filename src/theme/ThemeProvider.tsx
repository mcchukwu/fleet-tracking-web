import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { guardedStorage } from "../lib/storage";
import { isAccent } from "./accents";
import { ThemeContext, type Accent, type ThemeMode } from "./theme-context";

const THEME_KEY = "fleet.theme";
const ACCENT_KEY = "fleet.accent";

function isMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function readMode(): ThemeMode {
  const value = guardedStorage.get(THEME_KEY);
  return isMode(value) ? value : "system";
}

function readAccent(): Accent {
  const value = guardedStorage.get(ACCENT_KEY);
  return isAccent(value) ? value : "blue";
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readMode);
  const [accent, setAccentState] = useState<Accent>(readAccent);
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  // Layout effects run before child passive effects, so consumers that read CSS
  // variables in useEffect (the map adapter) see the new theme in the same commit.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.dataset.theme = resolved;
  }, [resolved]);

  useLayoutEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    guardedStorage.set(THEME_KEY, next);
  }, []);

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    guardedStorage.set(ACCENT_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ mode, resolved, accent, setMode, setAccent }),
    [mode, resolved, accent, setMode, setAccent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

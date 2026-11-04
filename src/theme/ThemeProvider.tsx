import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext, type Accent, type ThemeMode } from "./theme-context";

const THEME_KEY = "fleet.theme";
const ACCENT_KEY = "fleet.accent";

function readMode(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_KEY); // guard-ignore: theme preference is the one allowed web-storage value.
    return value === "light" || value === "dark" || value === "system" ? value : "system";
  } catch {
    return "system";
  }
}

function readAccent(): Accent {
  try {
    const value = localStorage.getItem(ACCENT_KEY); // guard-ignore: accent preference lives beside the theme preference.
    return value === "violet" || value === "teal" ? value : "blue";
  } catch {
    return "blue";
  }
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
    try {
      localStorage.setItem(THEME_KEY, next); // guard-ignore: theme preference only.
    } catch {
      // Private mode can reject storage; the session still works.
    }
  }, []);

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    try {
      localStorage.setItem(ACCENT_KEY, next); // guard-ignore: accent preference only.
    } catch {
      // Private mode can reject storage; the session still works.
    }
  }, []);

  const value = useMemo(
    () => ({ mode, resolved, accent, setMode, setAccent }),
    [mode, resolved, accent, setMode, setAccent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export type ShortcutScope = "global" | "map" | "alerts" | "playback";

export interface ShortcutDefinition {
  id: string;
  keys: readonly string[];
  label: string;
  scope: ShortcutScope;
  active: boolean;
}

export const scopeLabels: Record<ShortcutScope, string> = {
  global: "Everywhere",
  map: "When the map is open",
  alerts: "When an alert row is focused",
  playback: "When playback is open",
};

export const shortcuts: readonly ShortcutDefinition[] = [
  { id: "focus-search", keys: ["/"], label: "Focus vehicle search", scope: "global", active: true },
  { id: "shortcuts", keys: ["?"], label: "Open keyboard shortcuts", scope: "global", active: true },
  { id: "go-map", keys: ["g", "m"], label: "Go to Map", scope: "global", active: true },
  { id: "go-alerts", keys: ["g", "a"], label: "Go to Alerts", scope: "global", active: true },
  { id: "go-trips", keys: ["g", "t"], label: "Go to Trips", scope: "global", active: true },
  { id: "go-drivers", keys: ["g", "d"], label: "Go to Drivers", scope: "global", active: true },
  { id: "go-reports", keys: ["g", "r"], label: "Go to Reports", scope: "global", active: true },
  { id: "close", keys: ["Esc"], label: "Close the drawer or clear the search", scope: "global", active: true },
  { id: "next-vehicle", keys: ["j"], label: "Next vehicle", scope: "map", active: false },
  { id: "previous-vehicle", keys: ["k"], label: "Previous vehicle", scope: "map", active: false },
  { id: "open-vehicle", keys: ["Enter"], label: "Open the selected vehicle", scope: "map", active: false },
  { id: "toggle-panel", keys: ["["], label: "Toggle the vehicle panel", scope: "map", active: false },
  { id: "acknowledge", keys: ["a"], label: "Acknowledge the focused alert", scope: "alerts", active: false },
  { id: "play-pause", keys: ["Space"], label: "Play or pause playback", scope: "playback", active: false },
  { id: "step-back", keys: ["←"], label: "Step back one position", scope: "playback", active: false },
  { id: "step-forward", keys: ["→"], label: "Step forward one position", scope: "playback", active: false },
  { id: "slower", keys: [","], label: "Slower playback", scope: "playback", active: false },
  { id: "faster", keys: ["."], label: "Faster playback", scope: "playback", active: false },
];

export const chordTargets: Record<string, string> = {
  m: "/map",
  a: "/alerts",
  t: "/trips",
  d: "/drivers",
  r: "/reports",
};

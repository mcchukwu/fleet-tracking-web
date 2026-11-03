import type { MapTokens } from "./types";

const TOKEN_VARIABLES = {
  surface: "--surface",
  text: "--text",
  textMuted: "--text-muted",
  accent: "--accent",
  moving: "--moving",
  idle: "--idle",
  offline: "--offline",
  alert: "--alert",
  geofenceDepot: "--gf-depot",
  geofenceCustomer: "--gf-customer",
  geofenceRestricted: "--gf-restricted",
  geofenceOther: "--gf-other",
} as const;

function readVariable(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim();
}

export function readMapTokens(element: HTMLElement = document.documentElement): MapTokens {
  const styles = window.getComputedStyle(element);
  const colors: MapTokens["colors"] = {
    surface: readVariable(styles, TOKEN_VARIABLES.surface),
    text: readVariable(styles, TOKEN_VARIABLES.text),
    textMuted: readVariable(styles, TOKEN_VARIABLES.textMuted),
    accent: readVariable(styles, TOKEN_VARIABLES.accent),
    moving: readVariable(styles, TOKEN_VARIABLES.moving),
    idle: readVariable(styles, TOKEN_VARIABLES.idle),
    offline: readVariable(styles, TOKEN_VARIABLES.offline),
    alert: readVariable(styles, TOKEN_VARIABLES.alert),
    geofenceDepot: readVariable(styles, TOKEN_VARIABLES.geofenceDepot),
    geofenceCustomer: readVariable(styles, TOKEN_VARIABLES.geofenceCustomer),
    geofenceRestricted: readVariable(styles, TOKEN_VARIABLES.geofenceRestricted),
    geofenceOther: readVariable(styles, TOKEN_VARIABLES.geofenceOther),
  };

  return {
    colors,
    fonts: {
      ui: readVariable(styles, "--font-ui"),
      data: readVariable(styles, "--font-data"),
    },
    marker: {
      radius: 12,
      ringWidth: 2,
      labelZoom: 13,
      clusterZoom: 11,
    },
    geofence: {
      fillOpacity: 0.12,
      strokeWidth: 2,
      labelZoom: 12,
    },
  };
}

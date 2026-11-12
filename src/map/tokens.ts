import type { MapTokens } from "./types";

const TOKEN_VARIABLES = {
  surface: "--surface",
  text: "--text",
  textMuted: "--text-muted",
  textInverse: "--text-inverse",
  accent: "--accent",
  moving: "--moving",
  idle: "--idle",
  offline: "--offline",
  alert: "--alert",
  geofenceDepot: "--gf-depot",
  geofenceCustomer: "--gf-customer",
  geofenceRestricted: "--gf-restricted",
  geofenceOther: "--gf-other",
  imagery: "--imagery-halo",
  basemapBackground: "--basemap-background",
  basemapEarth: "--basemap-earth",
  basemapWater: "--basemap-water",
  basemapPark: "--basemap-park",
  basemapBuilding: "--basemap-building",
  basemapRoad: "--basemap-road",
  basemapRoadMinor: "--basemap-road-minor",
  basemapBoundary: "--basemap-boundary",
  basemapLabel: "--basemap-label",
  basemapLabelHalo: "--basemap-label-halo",
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
    textInverse: readVariable(styles, TOKEN_VARIABLES.textInverse),
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
    basemap: {
      background: readVariable(styles, TOKEN_VARIABLES.basemapBackground),
      earth: readVariable(styles, TOKEN_VARIABLES.basemapEarth),
      water: readVariable(styles, TOKEN_VARIABLES.basemapWater),
      park: readVariable(styles, TOKEN_VARIABLES.basemapPark),
      building: readVariable(styles, TOKEN_VARIABLES.basemapBuilding),
      road: readVariable(styles, TOKEN_VARIABLES.basemapRoad),
      roadMinor: readVariable(styles, TOKEN_VARIABLES.basemapRoadMinor),
      boundary: readVariable(styles, TOKEN_VARIABLES.basemapBoundary),
      label: readVariable(styles, TOKEN_VARIABLES.basemapLabel),
      labelHalo: readVariable(styles, TOKEN_VARIABLES.basemapLabelHalo),
    },
    fonts: {
      ui: readVariable(styles, "--font-ui"),
      data: readVariable(styles, "--font-data"),
    },
    marker: {
      radius: 12,
      ringWidth: 2,
      hitRadius: 22,
      selectedRadius: 16,
      selectedRingWidth: 2,
      hoverRingWidth: 1,
      glyphSize: 12,
      labelZoom: 13,
      labelSize: 12,
      labelOffset: 1,
      clusterZoom: 11,
      clusterRadius: 22,
      clusterMaxZoom: 10,
      clusterTextSize: 12,
    },
    geofence: {
      fillOpacity: 0.12,
      strokeWidth: 2,
      labelZoom: 12,
      labelSize: 12,
    },
    route: {
      lineWidth: 3,
      chevronSpacing: 80,
      cursorRadius: 7,
      pinRadius: 5,
      pinRingWidth: 2,
      labelZoom: 12,
      labelSize: 12,
    },
    onImagery: {
      haloWidth: 2,
      haloColor: readVariable(styles, TOKEN_VARIABLES.imagery) || colors.surface,
    },
  };
}

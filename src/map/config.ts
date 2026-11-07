import type { Bounds, MapProvider, MapStyleId } from "./types";

function readProvider(): MapProvider {
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_MOCK === "1" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("map") === "fake"
  ) {
    return "fake";
  }
  return import.meta.env.VITE_MAP_PROVIDER === "google" ? "google" : "maplibre";
}

function readUrl(value: string | undefined, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

export interface SatelliteConfig {
  tilesUrl: string;
  attribution: string;
  attributionHref?: string;
}

export interface SatelliteEnv {
  VITE_SATELLITE_TILES_URL?: string;
  VITE_SATELLITE_ATTRIBUTION?: string;
  VITE_SATELLITE_ATTRIBUTION_HREF?: string;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Satellite is env-gated rather than API-gated: it exists only when both a raster
 * template and its required attribution are configured. A partial configuration
 * hides the option instead of shipping imagery we cannot credit.
 */
export function readSatelliteConfig(env: SatelliteEnv): SatelliteConfig | null {
  const tilesUrl = env.VITE_SATELLITE_TILES_URL?.trim() ?? "";
  const attribution = env.VITE_SATELLITE_ATTRIBUTION?.trim() ?? "";
  if (!tilesUrl || !attribution) return null;
  if (!isHttpUrl(tilesUrl) || !/\{z\}.*\{x\}.*\{y\}/.test(tilesUrl)) return null;

  const href = env.VITE_SATELLITE_ATTRIBUTION_HREF?.trim();
  if (href && !isHttpUrl(href)) return null;

  return {
    tilesUrl,
    attribution,
    ...(href ? { attributionHref: href } : {}),
  };
}

function readSatelliteEnv(): SatelliteEnv {
  return {
    VITE_SATELLITE_TILES_URL: import.meta.env.VITE_SATELLITE_TILES_URL,
    VITE_SATELLITE_ATTRIBUTION: import.meta.env.VITE_SATELLITE_ATTRIBUTION,
    VITE_SATELLITE_ATTRIBUTION_HREF: import.meta.env.VITE_SATELLITE_ATTRIBUTION_HREF,
  };
}

export const satelliteConfig = readSatelliteConfig(readSatelliteEnv());

export const availableMapStyles: readonly MapStyleId[] = satelliteConfig
  ? ["standard", "satellite"]
  : ["standard"];

export const mapConfig = {
  provider: readProvider(),
  styleUrls: {
    light: readUrl(import.meta.env.VITE_MAP_STYLE_URL_LIGHT, "https://tiles.openfreemap.org/styles/positron"),
    dark: readUrl(import.meta.env.VITE_MAP_STYLE_URL_DARK, "https://tiles.openfreemap.org/styles/dark"),
  },
  glyphsUrl: readUrl(
    import.meta.env.VITE_MAP_GLYPHS_URL,
    "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  ),
  attribution: {
    label: "© OpenStreetMap · OpenFreeMap",
    href: "https://openfreemap.org",
  },
  defaultBounds: {
    south: 4.2,
    west: 2.4,
    north: 8.6,
    east: 5.2,
  } as Bounds,
  options: {
    minZoom: 2,
    maxZoom: 18,
    dragRotate: true,
    pitchWithRotate: false,
    touchPitch: false,
  },
} as const;

export const mapProviderLabels: Record<MapProvider, string> = {
  maplibre: "MapLibre",
  google: "Google Maps",
  fake: "Fake map",
};

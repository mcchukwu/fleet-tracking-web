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

export interface MapTilerConfig {
  apiKey: string;
}

export interface MapTilerEnv {
  VITE_MAPTILER_API_KEY?: string;
}

export type MapTilerStyleId = "streets" | "satellite";

/**
 * MapTiler is opt-in through the build environment. A missing key hides the
 * hosted styles rather than shipping a map that cannot load.
 */
export function readMapTilerConfig(env: MapTilerEnv): MapTilerConfig | null {
  const apiKey = env.VITE_MAPTILER_API_KEY?.trim() ?? "";
  return apiKey === "" ? null : { apiKey };
}

export function availableStyles(config: MapTilerConfig | null): readonly MapStyleId[] {
  return config ? ["standard", "streets", "satellite"] : ["standard"];
}

export function mapTilerMapId(
  style: MapTilerStyleId,
  theme: "light" | "dark",
): "streets-v4" | "streets-v4-dark" | "hybrid-v4" {
  if (style === "satellite") return "hybrid-v4";
  return theme === "dark" ? "streets-v4-dark" : "streets-v4";
}

/** The API key is query data; never log this URL or its query string. */
export function mapTilerStyleUrl(
  style: MapTilerStyleId,
  theme: "light" | "dark",
  config: MapTilerConfig,
): string {
  return `https://api.maptiler.com/maps/${mapTilerMapId(style, theme)}/style.json?key=${encodeURIComponent(config.apiKey)}`;
}

export const MAPTILER_HOME = "https://www.maptiler.com";

function readMapTilerEnv(): MapTilerEnv {
  return {
    VITE_MAPTILER_API_KEY: import.meta.env.VITE_MAPTILER_API_KEY,
  };
}

export const mapTilerConfig = readMapTilerConfig(readMapTilerEnv());

export const availableMapStyles = availableStyles(mapTilerConfig);

export const mapConfig = {
  provider: readProvider(),
  styleUrls: {
    light: readUrl(import.meta.env.VITE_MAP_STYLE_URL_LIGHT, "https://tiles.openfreemap.org/styles/positron"),
    dark: readUrl(import.meta.env.VITE_MAP_STYLE_URL_DARK, "https://tiles.openfreemap.org/styles/dark"),
  },
  // Only the standard base style uses this override; hosted styles bring their
  // own glyphs and sprites.
  glyphsUrl: import.meta.env.VITE_MAP_GLYPHS_URL?.trim() ?? "",
  /** Empty means the hosted OpenFreeMap standard style and no offline map. */
  pmtilesUrl: import.meta.env.VITE_MAP_PMTILES_URL?.trim() ?? "",
  localGlyphsUrl: readUrl(import.meta.env.VITE_MAP_GLYPHS_URL, "/map/fonts/{fontstack}/{range}.pbf"),
  localSpriteBaseUrl: readUrl(import.meta.env.VITE_MAP_SPRITE_URL, "/map/sprites"),
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

export interface MapAttributionLink {
  label: string;
  href: string;
}

/** The build can only work offline when it ships a local pack. */
export function mapOfflineConfigured(): boolean {
  return mapConfig.pmtilesUrl !== "";
}

/** What the UI may assume before an adapter has mounted. */
export function mapOfflineHint(): boolean {
  return mapConfig.provider === "fake" ? true : mapOfflineConfigured();
}

/** Standard style credit follows the source that actually renders the tiles. */
export function standardAttribution(pmtilesUrl: string = mapConfig.pmtilesUrl): MapAttributionLink {
  return pmtilesUrl !== ""
    ? { label: "© OpenStreetMap · Protomaps", href: "https://protomaps.com" }
    : mapConfig.attribution;
}

export const mapProviderLabels: Record<MapProvider, string> = {
  maplibre: "MapLibre",
  google: "Google Maps",
  fake: "Fake map",
};

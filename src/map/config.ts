import type { Bounds, MapProvider } from "./types";

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

export const mapConfig = {
  provider: readProvider(),
  styleUrls: {
    light: readUrl(import.meta.env.VITE_MAP_STYLE_URL_LIGHT, "https://tiles.openfreemap.org/styles/positron"),
    dark: readUrl(import.meta.env.VITE_MAP_STYLE_URL_DARK, "https://tiles.openfreemap.org/styles/dark"),
  },
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
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  },
} as const;

export const mapProviderLabels: Record<MapProvider, string> = {
  maplibre: "MapLibre",
  google: "Google Maps",
  fake: "Fake map",
};

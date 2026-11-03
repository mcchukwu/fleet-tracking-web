import type { MapProvider } from "./types";

function readProvider(): MapProvider {
  return import.meta.env.VITE_MAP_PROVIDER === "google" ? "google" : "maplibre";
}

export const mapConfig = {
  provider: readProvider(),
} as const;

export const mapProviderLabels: Record<MapProvider, string> = {
  maplibre: "MapLibre",
  google: "Google Maps",
};

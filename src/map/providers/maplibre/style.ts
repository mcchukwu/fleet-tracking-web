import type { StyleSpecification } from "maplibre-gl";
import { mapConfig, type SatelliteConfig } from "../../config";
import type { MapStyleId, MapTokens } from "../../types";

export function styleUrlFor(theme: "light" | "dark"): string {
  return mapConfig.styleUrls[theme];
}

/** Satellite is a raster source; vehicle, geofence and route layers stay on top. */
export function buildSatelliteStyle(
  theme: "light" | "dark",
  tokens: MapTokens,
  config: SatelliteConfig,
): StyleSpecification {
  return {
    version: 8,
    name: `fleet-satellite-${theme}`,
    glyphs: mapConfig.glyphsUrl,
    sources: {
      "fleet-satellite": {
        type: "raster",
        tiles: [config.tilesUrl],
        tileSize: 256,
        attribution: config.attribution,
      },
    },
    layers: [
      {
        id: "fleet-satellite-imagery",
        type: "raster",
        source: "fleet-satellite",
        paint: { "raster-opacity": 1 },
      },
      {
        id: "fleet-satellite-scrim",
        type: "background",
        paint: {
          "background-color": tokens.colors.surface,
          "background-opacity": theme === "dark" ? 0.12 : 0.04,
        },
      },
    ],
  };
}

export function styleFor(
  id: MapStyleId,
  theme: "light" | "dark",
  tokens: MapTokens,
  satellite: SatelliteConfig | null,
): string | StyleSpecification {
  if (id === "satellite" && satellite) return buildSatelliteStyle(theme, tokens, satellite);
  return styleUrlFor(theme);
}

/**
 * A background-only style used when the remote basemap cannot load. Data layers are
 * still installed, so the operational map keeps working without the cartography.
 */
export function fallbackStyle(theme: "light" | "dark", tokens: MapTokens): StyleSpecification {
  return {
    version: 8,
    name: `fleet-fallback-${theme}`,
    sources: {},
    layers: [
      {
        id: "fleet-fallback-background",
        type: "background",
        paint: { "background-color": tokens.colors.surface },
      },
    ],
  };
}

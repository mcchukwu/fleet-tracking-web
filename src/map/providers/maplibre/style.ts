import type { StyleSpecification } from "maplibre-gl";
import { mapConfig } from "../../config";
import type { MapTokens } from "../../types";

export function styleUrlFor(theme: "light" | "dark"): string {
  return mapConfig.styleUrls[theme];
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

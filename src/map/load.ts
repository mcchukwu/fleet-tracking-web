import { MapError } from "../errors/types";
import { mapConfig } from "./config";
import type { MapAdapter, MapProvider } from "./types";

export async function loadMapAdapter(provider: MapProvider = mapConfig.provider): Promise<MapAdapter> {
  if (provider === "maplibre") {
    const module = await import("./providers/maplibre");
    return module.createMapLibreAdapter();
  }

  throw new MapError(`The ${provider} map provider is not available in this build.`);
}

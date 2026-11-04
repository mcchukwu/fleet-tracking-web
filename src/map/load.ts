import { MapError } from "../errors/types";
import { mapConfig } from "./config";
import type { MapAdapter, MapProvider } from "./types";

export async function loadMapAdapter(provider: MapProvider = mapConfig.provider): Promise<MapAdapter> {
  if (provider === "maplibre") {
    const module = await import("./providers/maplibre");
    return module.createMapLibreAdapter();
  }

  if (provider === "fake" && import.meta.env.DEV && import.meta.env.VITE_MOCK === "1") {
    const module = await import("./testing/FakeAdapter");
    const broken = new URLSearchParams(window.location.search).get("adapter") === "error";
    return broken ? new module.BrokenAdapter() : new module.FakeAdapter();
  }

  throw new MapError(`The ${provider} map provider is not available in this build.`);
}

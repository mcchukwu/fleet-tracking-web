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
    const params = new URLSearchParams(window.location.search);
    const broken = params.get("adapter") === "error";
    // `offline=0` proves the provider-capability fallback with the fake adapter.
    const offline = params.get("offline") !== "0";
    return broken ? new module.BrokenAdapter() : new module.FakeAdapter({ offline });
  }

  throw new MapError(`The ${provider} map provider is not available in this build.`);
}

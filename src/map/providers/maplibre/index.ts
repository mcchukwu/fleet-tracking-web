import { MapError } from "../../../errors/types";
import type { DrawController, MapAdapter } from "../../types";

export function createMapLibreAdapter(): MapAdapter {
  const draw: DrawController = {
    start: () => undefined,
    stop: () => undefined,
    getGeometry: () => null,
    onChange: () => () => undefined,
  };

  return {
    id: "maplibre",
    capabilities: {
      offline: true,
      drawing: true,
      clustering: "native",
      comfortableVehicleCount: 2_000,
    },
    draw,
    mount: () => Promise.reject(new MapError("The MapLibre renderer arrives in Slice 2.")),
    destroy: () => undefined,
    setTheme: () => undefined,
    setVehicles: () => undefined,
    setGeofences: () => undefined,
    setRoute: () => undefined,
    fitBounds: () => undefined,
    flyTo: () => undefined,
    getViewport: () => ({ center: [0, 0], zoom: 0 }),
    on: () => () => undefined,
  };
}

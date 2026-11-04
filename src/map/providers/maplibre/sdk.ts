import { Map, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  MapMouseEvent,
  MapOptions,
} from "maplibre-gl";

export function createMap(options: ConstructorParameters<typeof Map>[0]): Map {
  return new Map(options);
}

export function createNavigationControl(): NavigationControl {
  return new NavigationControl({ showCompass: true, showZoom: true, visualizePitch: false });
}

export { NavigationControl };

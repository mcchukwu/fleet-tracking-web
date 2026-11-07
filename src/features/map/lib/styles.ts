import type { MapStyleId } from "../../../map/types";

export const MAP_STYLE_LABELS: Record<MapStyleId, string> = {
  standard: "Map",
  streets: "Streets",
  satellite: "Satellite",
};

export const MAP_STYLE_OFFLINE_REASON = "Needs a connection";

export function isHostedMapStyle(id: MapStyleId): boolean {
  return id === "streets" || id === "satellite";
}

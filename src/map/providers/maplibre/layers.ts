import type { LayerSpecification } from "maplibre-gl";
import type { FeatureCollection, LineString, Point, Polygon } from "geojson";
import type { LngLat, MapGeofence, MapRoute, MapTokens, MapVehicle } from "../../types";

export const SOURCE_IDS = {
  vehicles: "fleet-vehicles",
  geofences: "fleet-geofences",
  route: "fleet-route",
} as const;

export const LAYER_IDS = {
  geofenceFill: "fleet-geofence-fill",
  geofenceHatch: "fleet-geofence-hatch",
  geofenceLineDepot: "fleet-geofence-line-depot",
  geofenceLineCustomer: "fleet-geofence-line-customer",
  geofenceLineRestricted: "fleet-geofence-line-restricted",
  geofenceLineOther: "fleet-geofence-line-other",
  geofenceLabel: "fleet-geofence-label",
  routeGap: "fleet-route-gap",
  routeLine: "fleet-route-line",
  vehicleHit: "fleet-vehicle-hit",
  vehicleSelected: "fleet-vehicle-selected",
  vehicleHover: "fleet-vehicle-hover",
  vehicleAlertRing: "fleet-vehicle-alert-ring",
  vehicleCircle: "fleet-vehicle-circle",
  vehicleGlyph: "fleet-vehicle-glyph",
  vehicleLabel: "fleet-vehicle-label",
  clusterCircle: "fleet-cluster-circle",
  clusterCount: "fleet-cluster-count",
} as const;

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

export function emptyCollection(): FeatureCollection {
  return EMPTY;
}

function circle(
  id: string,
  paint: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): LayerSpecification {
  return {
    id,
    type: "circle",
    source: SOURCE_IDS.vehicles,
    paint,
    ...extra,
  } as LayerSpecification;
}

const statusColor = (tokens: MapTokens): unknown[] => [
  "match",
  ["get", "status"],
  "moving",
  tokens.colors.moving,
  "idle",
  tokens.colors.idle,
  "alert",
  tokens.colors.alert,
  tokens.colors.surface,
];

export function vehicleLayers(tokens: MapTokens): LayerSpecification[] {
  return [
    circle(LAYER_IDS.vehicleHit, {
      "circle-radius": tokens.marker.hitRadius,
      "circle-color": tokens.colors.text,
      "circle-opacity": 0,
    }),
    circle(
      LAYER_IDS.vehicleSelected,
      {
        "circle-radius": tokens.marker.selectedRadius,
        "circle-color": tokens.colors.accent,
        "circle-opacity": 0,
        "circle-stroke-color": tokens.colors.accent,
        "circle-stroke-width": tokens.marker.selectedRingWidth,
      },
      { filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "selected"], true]] },
    ),
    circle(
      LAYER_IDS.vehicleHover,
      {
        "circle-radius": tokens.marker.radius + tokens.marker.hoverRingWidth + 1,
        "circle-color": tokens.colors.text,
        "circle-opacity": 0,
        "circle-stroke-color": tokens.colors.text,
        "circle-stroke-width": tokens.marker.hoverRingWidth,
      },
      { filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "hovered"], true]] },
    ),
    circle(
      LAYER_IDS.vehicleAlertRing,
      {
        "circle-radius": tokens.marker.radius + 2,
        "circle-color": tokens.colors.alert,
        "circle-opacity": 0,
        "circle-stroke-color": tokens.colors.alert,
        "circle-stroke-width": tokens.marker.ringWidth,
      },
      { filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "status"], "alert"]] },
    ),
    circle(
      LAYER_IDS.vehicleCircle,
      {
        "circle-radius": tokens.marker.radius,
        "circle-color": statusColor(tokens),
        "circle-stroke-color": [
          "match",
          ["get", "status"],
          "offline",
          tokens.colors.offline,
          tokens.colors.surface,
        ],
        "circle-stroke-width": tokens.marker.ringWidth,
      },
      { filter: ["!", ["has", "point_count"]] },
    ),
    {
      id: LAYER_IDS.vehicleGlyph,
      type: "symbol",
      source: SOURCE_IDS.vehicles,
      filter: [
        "all",
        ["!", ["has", "point_count"]],
        ["any", ["==", ["get", "status"], "moving"], ["==", ["get", "status"], "alert"]],
      ],
      layout: {
        "icon-image": ["match", ["get", "status"], "alert", "fleet-alert", "fleet-chevron"],
        "icon-size": 1,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotation-alignment": "map",
        "icon-rotate": ["coalesce", ["get", "heading"], 0],
      },
      paint: {
        "icon-opacity": ["case", ["get", "stale"], 0.6, 1],
      },
    },
    {
      id: LAYER_IDS.vehicleLabel,
      type: "symbol",
      source: SOURCE_IDS.vehicles,
      minzoom: tokens.marker.labelZoom,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Regular"],
        "text-size": tokens.marker.labelSize,
        "text-anchor": "top",
        "text-offset": [0, tokens.marker.labelOffset],
        "text-allow-overlap": false,
        "text-ignore-placement": false,
      },
      paint: {
        "text-color": tokens.colors.text,
        "text-halo-color": tokens.colors.surface,
        "text-halo-width": 1.5,
      },
    },
    circle(
      LAYER_IDS.clusterCircle,
      {
        "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 100, 22],
        "circle-color": [
          "match",
          ["get", "worstStatus"],
          3,
          tokens.colors.alert,
          2,
          tokens.colors.moving,
          1,
          tokens.colors.idle,
          tokens.colors.offline,
        ],
        "circle-stroke-color": tokens.colors.surface,
        "circle-stroke-width": tokens.marker.ringWidth,
      },
      { filter: ["has", "point_count"] },
    ),
    {
      id: LAYER_IDS.clusterCount,
      type: "symbol",
      source: SOURCE_IDS.vehicles,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Noto Sans Regular"],
        "text-size": tokens.marker.clusterTextSize,
      },
      paint: {
        "text-color": tokens.colors.textInverse,
      },
    },
  ];
}

const geofenceLine = (
  id: string,
  kind: "depot" | "customer" | "restricted" | "other",
  color: string,
  dasharray: number[] | null,
  width: number,
): LayerSpecification => ({
  id,
  type: "line",
  source: SOURCE_IDS.geofences,
  filter: ["==", ["get", "kind"], kind],
  layout: { "line-cap": "round", "line-join": "round" },
  paint: {
    "line-color": color,
    "line-width": width,
    ...(dasharray ? { "line-dasharray": dasharray } : {}),
  },
});

export function geofenceLayers(tokens: MapTokens): LayerSpecification[] {
  return [
    {
      id: LAYER_IDS.geofenceFill,
      type: "fill",
      source: SOURCE_IDS.geofences,
      paint: {
        "fill-color": [
          "match",
          ["get", "kind"],
          "depot",
          tokens.colors.geofenceDepot,
          "customer",
          tokens.colors.geofenceCustomer,
          "restricted",
          tokens.colors.geofenceRestricted,
          tokens.colors.geofenceOther,
        ],
        "fill-opacity": tokens.geofence.fillOpacity,
      },
    },
    {
      id: LAYER_IDS.geofenceHatch,
      type: "fill",
      source: SOURCE_IDS.geofences,
      filter: ["==", ["get", "kind"], "restricted"],
      paint: {
        "fill-pattern": "fleet-hatch",
        "fill-opacity": 0.55,
      },
    },
    geofenceLine(
      LAYER_IDS.geofenceLineDepot,
      "depot",
      tokens.colors.geofenceDepot,
      null,
      tokens.geofence.strokeWidth,
    ),
    geofenceLine(
      LAYER_IDS.geofenceLineCustomer,
      "customer",
      tokens.colors.geofenceCustomer,
      [1, 2],
      tokens.geofence.strokeWidth,
    ),
    geofenceLine(
      LAYER_IDS.geofenceLineRestricted,
      "restricted",
      tokens.colors.geofenceRestricted,
      [4, 3],
      tokens.geofence.strokeWidth,
    ),
    geofenceLine(
      LAYER_IDS.geofenceLineOther,
      "other",
      tokens.colors.geofenceOther,
      null,
      1,
    ),
    {
      id: LAYER_IDS.geofenceLabel,
      type: "symbol",
      source: SOURCE_IDS.geofences,
      minzoom: tokens.geofence.labelZoom,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": tokens.geofence.labelSize,
        "symbol-placement": "point",
      },
      paint: {
        "text-color": tokens.colors.text,
        "text-halo-color": tokens.colors.surface,
        "text-halo-width": 1.5,
      },
    },
  ];
}

export function routeLayers(tokens: MapTokens): LayerSpecification[] {
  return [
    {
      id: LAYER_IDS.routeGap,
      type: "line",
      source: SOURCE_IDS.route,
      filter: ["==", ["get", "gap"], true],
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": tokens.colors.accent,
        "line-width": 3,
        "line-dasharray": [2, 2],
      },
    },
    {
      id: LAYER_IDS.routeLine,
      type: "line",
      source: SOURCE_IDS.route,
      filter: ["==", ["get", "gap"], false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": tokens.colors.accent,
        "line-width": 3,
      },
    },
  ];
}

export function vehicleCollection(
  vehicles: readonly MapVehicle[],
  positions?: ReadonlyMap<string, LngLat>,
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: vehicles.map((vehicle) => {
      const position = positions?.get(vehicle.key) ?? vehicle.position;
      return {
        type: "Feature",
        id: vehicle.key,
        properties: {
          key: vehicle.key,
          label: vehicle.label,
          status: vehicle.status,
          selected: vehicle.selected,
          hovered: vehicle.hovered,
          stale: vehicle.stale,
          heading: vehicle.headingDeg ?? 0,
        },
        geometry: { type: "Point", coordinates: position },
      };
    }),
  };
}

export function geofenceCollection(geofences: readonly MapGeofence[]): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: geofences.map((geofence) => ({
      type: "Feature",
      id: geofence.id,
      properties: {
        id: geofence.id,
        name: geofence.name,
        kind: geofence.kind,
        highlighted: geofence.highlighted,
      },
      geometry: { type: "Polygon", coordinates: geofence.rings },
    })),
  };
}

export function routeCollection(route: MapRoute | null): FeatureCollection<LineString> {
  if (!route || route.points.length < 2) return { type: "FeatureCollection", features: [] };

  const features: Array<{
    type: "Feature";
    properties: { gap: boolean };
    geometry: LineString;
  }> = [];

  for (let index = 1; index < route.points.length; index += 1) {
    const from = route.points[index - 1];
    const to = route.points[index];
    if (!from || !to) continue;
    features.push({
      type: "Feature",
      properties: { gap: route.gapAfterIndex.includes(index - 1) },
      geometry: { type: "LineString", coordinates: [from, to] },
    });
  }

  return { type: "FeatureCollection", features };
}

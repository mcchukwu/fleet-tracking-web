import type { LayerSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type { LngLat, MapGeofence, MapTokens, MapVehicle } from "../../types";

export const SOURCE_IDS = {
  vehicles: "fleet-vehicles",
  geofences: "fleet-geofences",
  route: "fleet-route",
  routePoints: "fleet-route-points",
} as const;

export const LAYER_IDS = {
  geofenceFill: "fleet-geofence-fill",
  geofenceHatch: "fleet-geofence-hatch",
  geofenceHalo: "fleet-geofence-halo",
  geofenceLineDepot: "fleet-geofence-line-depot",
  geofenceLineCustomer: "fleet-geofence-line-customer",
  geofenceLineRestricted: "fleet-geofence-line-restricted",
  geofenceLineOther: "fleet-geofence-line-other",
  geofenceLabel: "fleet-geofence-label",
  routeHalo: "fleet-route-halo",
  routeGap: "fleet-route-gap",
  routeLine: "fleet-route-line",
  routeChevrons: "fleet-route-chevrons",
  routePinStart: "fleet-route-pin-start",
  routePinEnd: "fleet-route-pin-end",
  routePinLabel: "fleet-route-pin-label",
  routeCursor: "fleet-route-cursor",
  vehicleHit: "fleet-vehicle-hit",
  vehicleHalo: "fleet-vehicle-halo",
  vehicleSelectedHalo: "fleet-vehicle-selected-halo",
  vehicleSelected: "fleet-vehicle-selected",
  vehicleHover: "fleet-vehicle-hover",
  vehicleAlertRing: "fleet-vehicle-alert-ring",
  vehicleCircle: "fleet-vehicle-circle",
  vehicleGlyph: "fleet-vehicle-glyph",
  vehicleLabel: "fleet-vehicle-label",
  clusterHalo: "fleet-cluster-halo",
  clusterCircle: "fleet-cluster-circle",
  clusterCount: "fleet-cluster-count",
} as const;

export interface LayerOptions {
  imagery?: boolean;
}

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

const staleOpacity = (active: number): unknown[] => ["case", ["get", "stale"], 0.6, active];

export function vehicleLayers(tokens: MapTokens, options: LayerOptions = {}): LayerSpecification[] {
  const imagery = options.imagery === true;
  const halo = tokens.onImagery;
  return [
    circle(LAYER_IDS.vehicleHit, {
      "circle-radius": tokens.marker.hitRadius,
      "circle-color": tokens.colors.text,
      "circle-opacity": 0,
    }),
    ...(imagery
      ? [
          circle(
            LAYER_IDS.vehicleHalo,
            {
              "circle-radius": tokens.marker.radius + halo.haloWidth,
              "circle-color": halo.haloColor,
            },
            { filter: ["!", ["has", "point_count"]] },
          ),
          circle(
            LAYER_IDS.vehicleSelectedHalo,
            {
              "circle-radius": tokens.marker.selectedRadius + halo.haloWidth,
              "circle-color": halo.haloColor,
            },
            { filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "selected"], true]] },
          ),
        ]
      : []),
    circle(
      LAYER_IDS.vehicleSelected,
      {
        "circle-radius": tokens.marker.selectedRadius,
        "circle-color": tokens.colors.accent,
        "circle-opacity": 0,
        "circle-stroke-color": tokens.colors.accent,
        "circle-stroke-width": tokens.marker.selectedRingWidth,
        "circle-stroke-opacity": staleOpacity(1),
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
        "circle-stroke-opacity": staleOpacity(1),
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
        "circle-stroke-opacity": staleOpacity(1),
      },
      { filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "status"], "alert"]] },
    ),
    circle(
      LAYER_IDS.vehicleCircle,
      {
        "circle-radius": tokens.marker.radius,
        "circle-color": statusColor(tokens),
        "circle-opacity": staleOpacity(1),
        "circle-stroke-color": [
          "match",
          ["get", "status"],
          "offline",
          tokens.colors.offline,
          tokens.colors.surface,
        ],
        "circle-stroke-width": tokens.marker.ringWidth,
        "circle-stroke-opacity": staleOpacity(1),
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
        // The alert glyph is upright; only the heading chevron rotates.
        "icon-rotate": [
          "case",
          ["==", ["get", "status"], "alert"],
          0,
          ["coalesce", ["get", "heading"], 0],
        ],
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
        "text-halo-color": imagery ? halo.haloColor : tokens.colors.surface,
        "text-halo-width": imagery ? halo.haloWidth : 1.5,
      },
    },
    ...(imagery
      ? [
          circle(
            LAYER_IDS.clusterHalo,
            {
              "circle-radius": [
                "step",
                ["get", "point_count"],
                14 + halo.haloWidth,
                10,
                18 + halo.haloWidth,
                100,
                22 + halo.haloWidth,
              ],
              "circle-color": halo.haloColor,
            },
            { filter: ["has", "point_count"] },
          ),
        ]
      : []),
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
        ...(imagery
          ? { "text-halo-color": halo.haloColor, "text-halo-width": halo.haloWidth }
          : {}),
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

export function geofenceLayers(tokens: MapTokens, options: LayerOptions = {}): LayerSpecification[] {
  const imagery = options.imagery === true;
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
    ...(imagery
      ? [
          {
            id: LAYER_IDS.geofenceHalo,
            type: "line" as const,
            source: SOURCE_IDS.geofences,
            layout: { "line-cap": "round" as const, "line-join": "round" as const },
            paint: {
              "line-color": tokens.onImagery.haloColor,
              "line-width": tokens.geofence.strokeWidth + tokens.onImagery.haloWidth * 2,
            },
          },
        ]
      : []),
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
        "text-halo-color": imagery ? tokens.onImagery.haloColor : tokens.colors.surface,
        "text-halo-width": imagery ? tokens.onImagery.haloWidth : 1.5,
      },
    },
  ];
}

export function routeLayers(tokens: MapTokens, options: LayerOptions = {}): LayerSpecification[] {
  const imagery = options.imagery === true;
  const lineWidth = tokens.route.lineWidth;
  return [
    ...(imagery
      ? [
          {
            id: LAYER_IDS.routeHalo,
            type: "line" as const,
            source: SOURCE_IDS.route,
            layout: { "line-cap": "round" as const, "line-join": "round" as const },
            paint: {
              "line-color": tokens.onImagery.haloColor,
              "line-width": lineWidth + tokens.onImagery.haloWidth * 2,
            },
          },
        ]
      : []),
    {
      id: LAYER_IDS.routeGap,
      type: "line",
      source: SOURCE_IDS.route,
      filter: ["==", ["get", "gap"], true],
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": tokens.colors.accent,
        "line-width": lineWidth,
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
        "line-width": lineWidth,
      },
    },
    {
      id: LAYER_IDS.routeChevrons,
      type: "symbol",
      source: SOURCE_IDS.route,
      filter: ["==", ["get", "gap"], false],
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": tokens.route.chevronSpacing,
        "icon-image": "fleet-route-chevron",
        "icon-size": 0.5,
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: { "icon-opacity": 0.9 },
    },
    {
      id: LAYER_IDS.routePinStart,
      type: "circle",
      source: SOURCE_IDS.routePoints,
      filter: ["==", ["get", "role"], "start"],
      paint: {
        "circle-radius": tokens.route.pinRadius,
        "circle-color": tokens.colors.accent,
        "circle-stroke-color": tokens.colors.surface,
        "circle-stroke-width": tokens.route.pinRingWidth,
      },
    },
    {
      id: LAYER_IDS.routePinEnd,
      type: "circle",
      source: SOURCE_IDS.routePoints,
      filter: ["==", ["get", "role"], "end"],
      paint: {
        "circle-radius": tokens.route.pinRadius,
        "circle-color": tokens.colors.surface,
        "circle-stroke-color": tokens.colors.accent,
        "circle-stroke-width": tokens.route.pinRingWidth,
      },
    },
    {
      id: LAYER_IDS.routePinLabel,
      type: "symbol",
      source: SOURCE_IDS.routePoints,
      minzoom: tokens.route.labelZoom,
      filter: [
        "any",
        ["==", ["get", "role"], "start"],
        ["==", ["get", "role"], "end"],
      ],
      layout: {
        "text-field": ["match", ["get", "role"], "start", "Start", "end", "End", ""],
        "text-font": ["Noto Sans Regular"],
        "text-size": tokens.route.labelSize,
        "text-anchor": "bottom",
        "text-offset": [0, -1.2],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": tokens.colors.text,
        "text-halo-color": imagery ? tokens.onImagery.haloColor : tokens.colors.surface,
        "text-halo-width": imagery ? tokens.onImagery.haloWidth : 1.5,
      },
    },
    {
      id: LAYER_IDS.routeCursor,
      type: "circle",
      source: SOURCE_IDS.routePoints,
      filter: ["==", ["get", "role"], "cursor"],
      paint: {
        "circle-radius": tokens.route.cursorRadius,
        "circle-color": tokens.colors.accent,
        "circle-stroke-color": tokens.colors.surface,
        "circle-stroke-width": 2,
      },
    },
  ];
}

export interface VehicleFeatureCache {
  features: Map<string, Feature<Point>>;
}

function sameVehicle(
  feature: Feature<Point>,
  vehicle: MapVehicle,
  position: LngLat,
): boolean {
  const properties = feature.properties;
  return (
    feature.geometry.coordinates[0] === position[0] &&
    feature.geometry.coordinates[1] === position[1] &&
    properties?.key === vehicle.key &&
    properties.label === vehicle.label &&
    properties.status === vehicle.status &&
    properties.selected === vehicle.selected &&
    properties.hovered === vehicle.hovered &&
    properties.stale === vehicle.stale &&
    properties.heading === (vehicle.headingDeg ?? 0)
  );
}

export function vehicleCollection(
  vehicles: readonly MapVehicle[],
  positions?: ReadonlyMap<string, LngLat>,
  cache?: VehicleFeatureCache,
): FeatureCollection<Point> {
  const next = new Map<string, Feature<Point>>();
  const features = vehicles.map((vehicle) => {
    const position = positions?.get(vehicle.key) ?? vehicle.position;
    const cached = cache?.features.get(vehicle.key);
    if (cached && sameVehicle(cached, vehicle, position)) {
      next.set(vehicle.key, cached);
      return cached;
    }

    const feature: Feature<Point> = {
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
    next.set(vehicle.key, feature);
    return feature;
  });

  if (cache) cache.features = next;
  return { type: "FeatureCollection", features };
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

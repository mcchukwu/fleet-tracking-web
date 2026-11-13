import { describe, expect, it } from "vitest";
import { contractTokens } from "../../testing/adapter-contract";
import type { MapTokens } from "../../types";
import {
  LAYER_IDS,
  drawCollection,
  drawLayers,
  geofenceLayers,
  routeLayers,
  vehicleLayers,
} from "./layers";
const tokens: MapTokens = {
  ...contractTokens,
  onImagery: { haloWidth: 2, haloColor: "halo-token" },
};

function layerIds(layers: ReturnType<typeof vehicleLayers>): string[] {
  return layers.map((layer) => layer.id);
}

function paintOf(layers: ReturnType<typeof vehicleLayers>, id: string): Record<string, unknown> {
  const layer = layers.find((candidate) => candidate.id === id);
  if (!layer) throw new Error(`${id} layer is missing`);
  return layer.paint as Record<string, unknown>;
}

describe("imagery halos", () => {
  it("adds no halo layers on the standard basemap", () => {
    const ids = [
      ...layerIds(vehicleLayers(tokens)),
      ...layerIds(geofenceLayers(tokens)),
      ...layerIds(routeLayers(tokens)),
    ];
    expect(ids).not.toContain(LAYER_IDS.vehicleHalo);
    expect(ids).not.toContain(LAYER_IDS.clusterHalo);
    expect(ids).not.toContain(LAYER_IDS.geofenceHalo);
    expect(ids).not.toContain(LAYER_IDS.routeHalo);
  });

  it("puts the marker halo beneath the marker and uses the halo token", () => {
    const layers = vehicleLayers(tokens, { imagery: true });
    const haloIndex = layers.findIndex((layer) => layer.id === LAYER_IDS.vehicleHalo);
    const markerIndex = layers.findIndex((layer) => layer.id === LAYER_IDS.vehicleCircle);
    expect(haloIndex).toBeGreaterThanOrEqual(0);
    expect(haloIndex).toBeLessThan(markerIndex);

    const paint = paintOf(layers, LAYER_IDS.vehicleHalo);
    expect(paint["circle-color"]).toBe("halo-token");
    expect(paint["circle-radius"]).toEqual(tokens.marker.radius + tokens.onImagery.haloWidth);
  });

  it("widens the label halo to 2px on imagery", () => {
    const standard = paintOf(vehicleLayers(tokens), LAYER_IDS.vehicleLabel);
    const imagery = paintOf(vehicleLayers(tokens, { imagery: true }), LAYER_IDS.vehicleLabel);

    expect(standard["text-halo-width"]).toBe(1.5);
    expect(imagery["text-halo-width"]).toBe(2);
    expect(imagery["text-halo-color"]).toBe("halo-token");
  });

  it("adds geofence and route halos beneath their strokes", () => {
    const fences = geofenceLayers(tokens, { imagery: true });
    const routes = routeLayers(tokens, { imagery: true });
    const fenceHalo = fences.findIndex((layer) => layer.id === LAYER_IDS.geofenceHalo);
    const fenceStroke = fences.findIndex((layer) => layer.id === LAYER_IDS.geofenceLineDepot);
    const routeHalo = routes.findIndex((layer) => layer.id === LAYER_IDS.routeHalo);
    const routeLine = routes.findIndex((layer) => layer.id === LAYER_IDS.routeLine);

    expect(fenceHalo).toBeGreaterThanOrEqual(0);
    expect(fenceHalo).toBeLessThan(fenceStroke);
    expect(routeHalo).toBeGreaterThanOrEqual(0);
    expect(routeHalo).toBeLessThan(routeLine);

    const routePaint = paintOf(routes, LAYER_IDS.routeHalo);
    expect(routePaint["line-color"]).toBe("halo-token");
    expect(routePaint["line-width"]).toEqual(7);
  });

  it("haloes the cluster circle and count", () => {
    const layers = vehicleLayers(tokens, { imagery: true });
    expect(paintOf(layers, LAYER_IDS.clusterHalo)["circle-color"]).toBe("halo-token");
    expect(paintOf(layers, LAYER_IDS.clusterCount)["text-halo-width"]).toBe(2);
  });
});

describe("geofence selection and drawing", () => {
  it("puts an accent halo beneath the kind stroke for the highlighted polygon only", () => {
    const layers = geofenceLayers(tokens);
    const haloIndex = layers.findIndex((layer) => layer.id === LAYER_IDS.geofenceSelectedHalo);
    const strokeIndex = layers.findIndex((layer) => layer.id === LAYER_IDS.geofenceLineDepot);
    expect(haloIndex).toBeGreaterThanOrEqual(0);
    expect(haloIndex).toBeLessThan(strokeIndex);

    const halo = layers[haloIndex] as { filter?: unknown };
    expect(halo.filter).toEqual(["==", ["get", "highlighted"], true]);
    const paint = paintOf(layers, LAYER_IDS.geofenceSelectedHalo);
    expect(paint["line-color"]).toBe(tokens.colors.accent);
    expect(paint["line-width"]).toBe(tokens.geofence.strokeWidth + 4);
  });

  it("draws the unsaved polygon with a 12% accent fill and a dashed accent stroke", () => {
    const layers = drawLayers(tokens);
    expect(layerIds(layers)).toEqual([LAYER_IDS.drawFill, LAYER_IDS.drawLine]);

    const fill = paintOf(layers, LAYER_IDS.drawFill);
    expect(fill["fill-color"]).toBe(tokens.colors.accent);
    expect(fill["fill-opacity"]).toBe(0.12);

    const line = paintOf(layers, LAYER_IDS.drawLine);
    expect(line["line-color"]).toBe(tokens.colors.accent);
    expect(line["line-width"]).toBe(2);
    expect(line["line-dasharray"]).toEqual([2, 2]);
  });

  it("turns the unsaved geometry into one feature, or an empty collection", () => {
    expect(drawCollection(null)).toEqual({ type: "FeatureCollection", features: [] });
    const collection = drawCollection({
      type: "Polygon",
      coordinates: [
        [
          [3.4, 6.4],
          [3.5, 6.4],
          [3.5, 6.5],
          [3.4, 6.4],
        ],
      ],
    });
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.geometry).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [3.4, 6.4],
          [3.5, 6.4],
          [3.5, 6.5],
          [3.4, 6.4],
        ],
      ],
    });
  });
});

describe("route anatomy", () => {
  it("draws the line at the route token width with direction chevrons and pins", () => {
    const layers = routeLayers(tokens);
    const ids = layers.map((layer) => layer.id);
    expect(ids).toContain(LAYER_IDS.routeChevrons);
    expect(ids).toContain(LAYER_IDS.routePinStart);
    expect(ids).toContain(LAYER_IDS.routePinEnd);
    expect(ids).toContain(LAYER_IDS.routePinLabel);
    expect(ids).toContain(LAYER_IDS.routeCursor);

    expect(paintOf(layers, LAYER_IDS.routeLine)["line-width"]).toBe(tokens.route.lineWidth);
    expect(paintOf(layers, LAYER_IDS.routeGap)["line-dasharray"]).toEqual([2, 2]);

    const chevrons = layers.find((layer) => layer.id === LAYER_IDS.routeChevrons);
    expect(chevrons?.type).toBe("symbol");
    expect(chevrons?.layout).toMatchObject({
      "symbol-placement": "line",
      "symbol-spacing": tokens.route.chevronSpacing,
      "icon-image": "fleet-route-chevron",
    });
  });

  it("fills the start pin and rings the end pin", () => {
    const layers = routeLayers(tokens);
    expect(paintOf(layers, LAYER_IDS.routePinStart)["circle-color"]).toBe(tokens.colors.accent);
    expect(paintOf(layers, LAYER_IDS.routePinEnd)["circle-color"]).toBe(tokens.colors.surface);
    expect(paintOf(layers, LAYER_IDS.routePinEnd)["circle-stroke-color"]).toBe(
      tokens.colors.accent,
    );
    expect(paintOf(layers, LAYER_IDS.routeCursor)["circle-radius"]).toBe(tokens.route.cursorRadius);
  });

  it("keeps the cursor above the pins and the pins above the line", () => {
    const ids = routeLayers(tokens).map((layer) => layer.id);
    expect(ids.indexOf(LAYER_IDS.routeLine)).toBeLessThan(ids.indexOf(LAYER_IDS.routeChevrons));
    expect(ids.indexOf(LAYER_IDS.routeChevrons)).toBeLessThan(ids.indexOf(LAYER_IDS.routePinStart));
    expect(ids.indexOf(LAYER_IDS.routePinEnd)).toBeLessThan(ids.indexOf(LAYER_IDS.routeCursor));
  });

  it("shows Start and End labels from the route label zoom", () => {
    const label = routeLayers(tokens).find((layer) => layer.id === LAYER_IDS.routePinLabel);
    expect(label?.minzoom).toBe(tokens.route.labelZoom);
    expect(label?.layout).toMatchObject({
      "text-field": ["match", ["get", "role"], "start", "Start", "end", "End", ""],
      "text-size": tokens.route.labelSize,
    });
  });
});

import type { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode, HexColor } from "terra-draw";
import type { GeofenceKind, Polygon } from "../../../api/types";
import type { DrawController, LngLat, MapTokens } from "../../types";
import { repairRing } from "../../geofences";
import type { MapLibreMap } from "./sdk";

export interface DrawContext {
  getMap: () => MapLibreMap | null;
  getTokens: () => MapTokens | null;
}

/** Internal hooks the adapter may call; only the DrawController surface reaches features. */
export interface TerraDrawController extends DrawController {
  setTokens(tokens: MapTokens): void;
  restart(): void;
  dispose(): void;
}

export function polygonFromSnapshot(
  features: { geometry: { type: string; coordinates?: unknown } }[],
): Polygon | null {
  for (let index = features.length - 1; index >= 0; index -= 1) {
    const geometry = features[index]?.geometry;
    if (!geometry || geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates)) {
      continue;
    }
    const ring = geometry.coordinates[0];
    if (!Array.isArray(ring)) continue;
    const repaired = repairRing(ring);
    if (repaired) return { type: "Polygon", coordinates: [repaired] };
  }
  return null;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches("input, select, textarea") || target.isContentEditable === true)
  );
}

function polygonStyles(tokens: MapTokens) {
  const accent = tokens.colors.accent as HexColor;
  const surface = tokens.colors.surface as HexColor;
  return {
    fillColor: accent,
    fillOpacity: 0.12,
    outlineColor: accent,
    outlineWidth: 2,
    outlineOpacity: 1,
    closingPointColor: surface,
    closingPointWidth: 6,
    closingPointOutlineColor: accent,
    closingPointOutlineWidth: 2,
    coordinatePointColor: surface,
    coordinatePointWidth: 6,
    coordinatePointOutlineColor: accent,
    coordinatePointOutlineWidth: 2,
  };
}

/**
 * Terra Draw behind the MapAdapter contract. The library is imported on the
 * first `start()`, so the map screen never downloads the draw chunk.
 */
export function createTerraDrawController(context: DrawContext): TerraDrawController {
  let draw: TerraDraw | null = null;
  let polygonMode: TerraDrawPolygonMode | null = null;
  let selectMode: TerraDrawSelectMode | null = null;
  let geometry: Polygon | null = null;
  let kind: GeofenceKind = "other";
  let tokens = context.getTokens();
  let ready: Promise<void> | null = null;
  const listeners = new Set<(geometry: Polygon | null) => void>();

  const onChange = (): void => {
    const snapshot = draw?.getSnapshot() ?? [];
    const next = polygonFromSnapshot(snapshot);
    geometry = next;
    for (const listener of listeners) listener(next);
  };

  function emit(geometry: Polygon | null): void {
    for (const listener of listeners) listener(geometry);
  }

  const guardKeys = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target)) event.stopImmediatePropagation();
  };

  async function ensureDraw(): Promise<void> {
    if (draw) return;
    const map = context.getMap();
    if (!map) throw new Error("The map is not ready for drawing");

    const [{ TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode }, { TerraDrawMapLibreGLAdapter }] =
      await Promise.all([import("terra-draw"), import("terra-draw-maplibre-gl-adapter")]);

    const adapter = new TerraDrawMapLibreGLAdapter({ map, coordinatePrecision: 9 });
    const styles = tokens ? polygonStyles(tokens) : undefined;
    polygonMode = new TerraDrawPolygonMode({ ...(styles ? { styles } : {}) });
    selectMode = new TerraDrawSelectMode({
      flags: {
        polygon: {
          feature: {
            draggable: true,
            coordinates: { midpoints: true, draggable: true, deletable: false },
          },
        },
      },
      ...(styles
        ? {
            styles: {
              selectedPolygonColor: styles.fillColor,
              selectedPolygonFillOpacity: 0.12,
              selectedPolygonOutlineColor: styles.outlineColor,
              selectedPolygonOutlineWidth: 2,
            },
          }
        : {}),
    });

    draw = new TerraDraw({ adapter, modes: [polygonMode, selectMode] });
    draw.on("change", onChange);
    draw.on("finish", onChange);
    draw.on("select", onChange);
    draw.on("deselect", onChange);
    draw.start();
    document.addEventListener("keydown", guardKeys, true);
  }

  async function start(nextKind: GeofenceKind, ring?: LngLat[]): Promise<void> {
    kind = nextKind;
    tokens = context.getTokens();
    ready ??= ensureDraw();
    await ready;
    if (!draw) return;

    draw.clear();
    geometry = null;

    const repaired = ring ? repairRing(ring) : null;
    if (repaired) {
      const id = draw.getFeatureId();
      draw.addFeatures([
        {
          id,
          type: "Feature",
          properties: { mode: "polygon" },
          geometry: { type: "Polygon", coordinates: [repaired] },
        },
      ]);
      draw.setMode("select");
      draw.selectFeature(id);
      geometry = { type: "Polygon", coordinates: [repaired] };
    } else {
      draw.setMode("polygon");
    }
    emit(geometry);
  }

  function stopSession(): void {
    document.removeEventListener("keydown", guardKeys, true);
    if (!draw) return;
    draw.clear();
    draw.stop();
    draw = null;
    polygonMode = null;
    selectMode = null;
    ready = null;
  }

  return {
    start,
    stop(): void {
      // Committing keeps the last geometry for the caller's save step.
      stopSession();
    },
    cancel(): void {
      geometry = null;
      stopSession();
      emit(null);
    },
    getGeometry(): Polygon | null {
      return geometry;
    },
    onChange(listener: (geometry: Polygon | null) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setTokens(next: MapTokens): void {
      tokens = next;
      const styles = polygonStyles(next);
      polygonMode?.updateOptions({ styles });
      selectMode?.updateOptions({
        styles: {
          selectedPolygonColor: styles.fillColor,
          selectedPolygonFillOpacity: 0.12,
          selectedPolygonOutlineColor: styles.outlineColor,
          selectedPolygonOutlineWidth: 2,
        },
      });
    },
    restart(): void {
      const previousKind = kind;
      const previous =
        geometry && geometry.coordinates[0]
          ? (repairRing(geometry.coordinates[0]) ?? undefined)
          : undefined;
      stopSession();
      geometry = null;
      if (previous) {
        void start(previousKind, previous);
      } else {
        emit(null);
      }
    },
    dispose(): void {
      listeners.clear();
      stopSession();
      geometry = null;
    },
  };
}

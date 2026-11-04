import { MapError } from "../../../errors/types";
import { mapConfig } from "../../config";
import type {
  Bounds,
  LngLat,
  MapAdapter,
  MapCapabilities,
  MapEvents,
  MapGeofence,
  MapRoute,
  MapTokens,
  MapVehicle,
  MountOptions,
  Padding,
  Viewport,
} from "../../types";
import { installImages } from "./images";
import { glideDuration, glideProgress, lerpPosition } from "./interpolate";
import {
  emptyCollection,
  geofenceCollection,
  geofenceLayers,
  LAYER_IDS,
  routeCollection,
  routeLayers,
  SOURCE_IDS,
  vehicleCollection,
  vehicleLayers,
} from "./layers";
import {
  createMap,
  createNavigationControl,
  type GeoJSONSource,
  type MapLibreMap,
  type MapMouseEvent,
} from "./sdk";
import { fallbackStyle, styleUrlFor } from "./style";

const STYLE_TIMEOUT_MS = 3_000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function centerOf(bounds: Bounds): LngLat {
  return [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2];
}

function boundsCorners(bounds: Bounds): [[number, number], [number, number]] {
  return [
    [bounds.west, bounds.south],
    [bounds.east, bounds.north],
  ];
}

export function createMapLibreAdapter(): MapAdapter {
  let map: MapLibreMap | null = null;
  let theme: "light" | "dark" = "light";
  let tokens: MapTokens | null = null;
  let styleGeneration = 0;
  let vehicleTargets: readonly MapVehicle[] = [];
  let geofences: readonly MapGeofence[] = [];
  let route: MapRoute | null = null;
  let displayed = new Map<string, LngLat>();
  let animation: {
    from: ReadonlyMap<string, LngLat>;
    startedAt: number;
    duration: number;
  } | null = null;
  let frame: number | null = null;
  let lastVehiclesAt: number | null = null;
  let hoveredKey: string | null = null;

  const listeners = new Map<keyof MapEvents, Set<(payload: never) => void>>();

  const capabilities: MapCapabilities = {
    offline: false,
    drawing: false,
    clustering: "native",
    // Measured 2026-11-05: a 5,000-vehicle target produced a 348 ms longest
    // pan task in Chromium, so the comfort budget stays well below that.
    comfortableVehicleCount: 1_000,
  };

  function emit<K extends keyof MapEvents>(event: K, payload: MapEvents[K]): void {
    for (const listener of listeners.get(event) ?? []) {
      (listener as (value: MapEvents[K]) => void)(payload);
    }
  }

  function source(id: string): GeoJSONSource | null {
    const found = map?.getSource(id);
    return found ? (found as GeoJSONSource) : null;
  }

  function applyData(id: string, data: ReturnType<typeof geofenceCollection> | ReturnType<typeof vehicleCollection> | ReturnType<typeof routeCollection>): void {
    const target = source(id);
    if (target) void target.setData(data).catch(() => undefined);
  }

  function setVehicleData(): void {
    applyData(SOURCE_IDS.vehicles, vehicleCollection(vehicleTargets, displayed));
  }

  function cancelAnimation(): void {
    if (frame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    frame = null;
  }

  function animateVehicles(): void {
    const current = animation;
    if (!map || !current) return;
    const now = performance.now();
    const progress = glideProgress(current.startedAt, now, current.duration);
    displayed = new Map(
      vehicleTargets.map((vehicle) => [
        vehicle.key,
        lerpPosition(current.from.get(vehicle.key) ?? vehicle.position, vehicle.position, progress),
      ]),
    );
    setVehicleData();

    if (progress < 1 && typeof requestAnimationFrame === "function") {
      frame = requestAnimationFrame(animateVehicles);
    } else {
      frame = null;
      animation = null;
    }
  }

  function applyAllData(): void {
    if (!map) return;
    setVehicleData();
    applyData(SOURCE_IDS.geofences, geofenceCollection(geofences));
    applyData(SOURCE_IDS.route, routeCollection(route));
  }

  function removeLayers(): void {
    if (!map) return;
    for (const id of Object.values(LAYER_IDS)) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
  }

  function addLayers(): void {
    if (!map || !tokens) return;
    for (const layer of [
      ...geofenceLayers(tokens),
      ...routeLayers(tokens),
      ...vehicleLayers(tokens),
    ]) {
      if (!map.getLayer(layer.id)) map.addLayer(layer);
    }
  }

  function installLayers(): void {
    if (!map || !tokens) return;
    installImages(map, tokens);
    if (!map.getSource(SOURCE_IDS.geofences)) {
      map.addSource(SOURCE_IDS.geofences, { type: "geojson", data: emptyCollection() });
    }
    if (!map.getSource(SOURCE_IDS.route)) {
      map.addSource(SOURCE_IDS.route, { type: "geojson", data: emptyCollection() });
    }
    if (!map.getSource(SOURCE_IDS.vehicles)) {
      map.addSource(SOURCE_IDS.vehicles, {
        type: "geojson",
        data: emptyCollection(),
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: tokens.marker.clusterMaxZoom,
        clusterProperties: {
          worstStatus: [
            "max",
            [
              "case",
              ["==", ["get", "status"], "alert"],
              3,
              ["==", ["get", "status"], "moving"],
              2,
              ["==", ["get", "status"], "idle"],
              1,
              0,
            ],
          ],
        },
      });
    }
    addLayers();
    applyAllData();
  }

  function refreshTokens(): void {
    if (!map || !tokens) return;
    installImages(map, tokens);
    removeLayers();
    addLayers();
    applyAllData();
  }

  function wireEvents(instance: MapLibreMap): void {
    instance.on("moveend", () => {
      if (instance !== map) return;
      emit("viewportChange", viewportOf(instance));
    });

    instance.on("click", (event: MapMouseEvent) => {
      if (instance !== map) return;
      const [vehicle] = instance.queryRenderedFeatures(event.point, {
        layers: [LAYER_IDS.vehicleHit],
      });
      const vehicleKey = vehicle ? String(vehicle.properties?.key ?? "") : "";
      if (vehicleKey) {
        emit("vehicleClick", { key: vehicleKey });
        return;
      }

      const [cluster] = instance.queryRenderedFeatures(event.point, {
        layers: [LAYER_IDS.clusterCircle],
      });
      if (cluster) {
        const clusterId = Number(cluster.properties?.cluster_id ?? 0);
        const count = Number(cluster.properties?.point_count ?? 0);
        const geometry = cluster.geometry;
        if (geometry.type === "Point") {
          const coordinates: LngLat = [geometry.coordinates[0] ?? 0, geometry.coordinates[1] ?? 0];
          source(SOURCE_IDS.vehicles)
            ?.getClusterExpansionZoom(clusterId)
            .then((zoom) => {
              if (instance === map) instance.easeTo({ center: coordinates, zoom: zoom + 0.2 });
            })
            .catch(() => undefined);
        }
        emit("clusterClick", { clusterId: String(clusterId), count });
        return;
      }

      const [fence] = instance.queryRenderedFeatures(event.point, {
        layers: [LAYER_IDS.geofenceFill],
      });
      const geofenceId = fence ? String(fence.properties?.id ?? "") : "";
      if (geofenceId) {
        emit("geofenceClick", { id: geofenceId });
        return;
      }

      emit("mapClick", { point: [event.lngLat.lng, event.lngLat.lat] });
    });

    instance.on("mousemove", (event: MapMouseEvent) => {
      if (instance !== map) return;
      const [vehicle] = instance.queryRenderedFeatures(event.point, {
        layers: [LAYER_IDS.vehicleHit],
      });
      const key = vehicle ? String(vehicle.properties?.key ?? "") : "";
      instance.getCanvas().style.cursor = key ? "pointer" : "";

      if (key && key !== hoveredKey) {
        hoveredKey = key;
        emit("vehicleHover", { key, point: { x: event.point.x, y: event.point.y } });
      } else if (!key && hoveredKey !== null) {
        hoveredKey = null;
        emit("vehicleHover", null);
      }
    });

    instance.on("mouseout", () => {
      if (instance !== map) return;
      if (hoveredKey !== null) {
        hoveredKey = null;
        emit("vehicleHover", null);
      }
    });
  }

  function viewportOf(instance: MapLibreMap): Viewport {
    const center = instance.getCenter();
    const bounds = instance.getBounds();
    return {
      center: [center.lng, center.lat],
      zoom: instance.getZoom(),
      bounds: {
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      },
    };
  }

  async function waitForStyle(
    instance: MapLibreMap,
    attempt: number,
    styleTokens: MapTokens,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        action();
      };
      const timer = setTimeout(() => {
        if (settled) return;
        if (attempt > 0) {
          finish(() => reject(new MapError("The map style could not load")));
          return;
        }
        instance.setStyle(fallbackStyle(theme, styleTokens));
        waitForStyle(instance, 1, styleTokens).then(
          () => finish(resolve),
          () => finish(() => reject(new MapError("The map style could not load"))),
        );
      }, STYLE_TIMEOUT_MS);

      instance.once("style.load", () => finish(resolve));
    });
  }

  return {
    id: "maplibre",
    capabilities,

    async mount(element: HTMLElement, options: MountOptions): Promise<void> {
      if (map) throw new MapError("The map is already mounted");
      theme = options.theme;
      tokens = options.tokens;
      const bounds = options.bounds ?? mapConfig.defaultBounds;
      const instance = createMap({
        container: element,
        style: styleUrlFor(theme),
        center: centerOf(bounds),
        zoom: 7,
        attributionControl: false,
        ...mapConfig.options,
      });
      map = instance;
      instance.addControl(createNavigationControl(), "top-right");
      wireEvents(instance);

      await waitForStyle(instance, 0, options.tokens);
      if (map !== instance || !tokens) return;
      installLayers();
      emit("ready", undefined);
    },

    destroy(): void {
      cancelAnimation();
      const instance = map;
      map = null;
      animation = null;
      displayed = new Map();
      hoveredKey = null;
      if (instance) instance.remove();
    },

    setTheme(nextTheme: "light" | "dark", nextTokens: MapTokens): void {
      tokens = nextTokens;
      if (!map) {
        theme = nextTheme;
        return;
      }

      if (nextTheme !== theme) {
        theme = nextTheme;
        const instance = map;
        const generation = ++styleGeneration;
        instance.setStyle(styleUrlFor(theme));
        waitForStyle(instance, 0, nextTokens)
          .then(() => {
            if (map !== instance || generation !== styleGeneration) return;
            installLayers();
          })
          .catch(() => undefined);
        return;
      }

      refreshTokens();
    },

    setVehicles(vehicles: readonly MapVehicle[]): void {
      vehicleTargets = vehicles;
      if (!map) return;

      const now = performance.now();
      const duration = glideDuration(lastVehiclesAt, now, prefersReducedMotion());
      lastVehiclesAt = now;
      cancelAnimation();

      if (duration <= 0 || typeof requestAnimationFrame !== "function") {
        animation = null;
        displayed = new Map(vehicles.map((vehicle) => [vehicle.key, vehicle.position]));
        setVehicleData();
        return;
      }

      animation = {
        from: new Map(displayed),
        startedAt: now,
        duration,
      };
      frame = requestAnimationFrame(animateVehicles);
    },

    setGeofences(nextGeofences: readonly MapGeofence[]): void {
      geofences = nextGeofences;
      applyData(SOURCE_IDS.geofences, geofenceCollection(nextGeofences));
    },

    setRoute(nextRoute: MapRoute | null): void {
      route = nextRoute;
      applyData(SOURCE_IDS.route, routeCollection(nextRoute));
    },

    fitBounds(bounds: Bounds, options?: { padding?: Padding; animate?: boolean }): void {
      if (!map) return;
      const animate = options?.animate ?? true;
      map.fitBounds(boundsCorners(bounds), {
        ...(options?.padding ? { padding: options.padding } : {}),
        animate: animate && !prefersReducedMotion(),
        maxZoom: 12,
      });
    },

    flyTo(point: LngLat, zoom?: number): void {
      if (!map) return;
      map.flyTo({
        center: point,
        ...(zoom !== undefined ? { zoom } : {}),
        animate: !prefersReducedMotion(),
      });
    },

    getViewport(): Viewport {
      if (!map) {
        return {
          center: [0, 0],
          zoom: 0,
          bounds: { south: 0, west: 0, north: 0, east: 0 },
        };
      }
      return viewportOf(map);
    },

    on<K extends keyof MapEvents>(event: K, listener: (payload: MapEvents[K]) => void): () => void {
      const set = listeners.get(event) ?? new Set<(payload: never) => void>();
      set.add(listener as (payload: never) => void);
      listeners.set(event, set);
      return () => {
        set.delete(listener as (payload: never) => void);
      };
    },
  };
}

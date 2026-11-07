import { normalize } from "../../../errors/normalize";
import { MapError } from "../../../errors/types";
import type { StyleSpecification } from "maplibre-gl";
import {
  availableMapStyles,
  mapConfig,
  mapTilerConfig,
  type MapTilerConfig,
} from "../../config";
import type {
  Bounds,
  LngLat,
  MapAdapter,
  MapCapabilities,
  MapEvents,
  MapGeofence,
  MapRoute,
  MapStyleFailureReason,
  MapStyleId,
  MapStyleState,
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
  type VehicleFeatureCache,
} from "./layers";
import {
  createMap,
  type GeoJSONSource,
  type MapLibreMap,
  type MapMouseEvent,
} from "./sdk";
import {
  fallbackStyle,
  isMapTilerStyleId,
  loadBaseStyle,
  StyleLoadError,
  type LoadedBaseStyle,
} from "./style";

const STYLE_TIMEOUT_MS = 3_000;
const HIGH_VOLUME_UPDATE_MS = 50;

type StyleLoader = (
  id: MapStyleId,
  theme: "light" | "dark",
  mapTiler: MapTilerConfig | null,
  signal?: AbortSignal,
) => Promise<LoadedBaseStyle>;

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

function httpStatusOf(event: unknown): number | null {
  const error = (event as { error?: { status?: unknown } } | null)?.error;
  return typeof error?.status === "number" ? error.status : null;
}

function quotaReason(status: number | null): MapStyleFailureReason | null {
  return status === 403 || status === 429 ? "quota" : null;
}

export interface MapLibreAdapterOptions {
  styles?: readonly MapStyleId[];
  mapTiler?: MapTilerConfig | null;
  /** Test seam: lets unit tests avoid the network. */
  loadStyle?: StyleLoader;
}

export function createMapLibreAdapter(options: MapLibreAdapterOptions = {}): MapAdapter {
  const styles = options.styles ?? availableMapStyles;
  const mapTiler = options.mapTiler === undefined ? mapTilerConfig : options.mapTiler;
  const loadStyle = options.loadStyle ?? loadBaseStyle;
  let map: MapLibreMap | null = null;
  let theme: "light" | "dark" = "light";
  let tokens: MapTokens | null = null;
  let baseStyle: MapStyleId = "standard";
  let styleGeneration = 0;
  let styleAbort: AbortController | null = null;
  let fallbackInFlight = false;
  let currentAttribution: readonly string[] = [];
  let styleState: MapStyleState = {
    style: "standard",
    status: "ready",
    attribution: null,
  };
  let vehicleTargets: readonly MapVehicle[] = [];
  let geofences: readonly MapGeofence[] = [];
  let route: MapRoute | null = null;
  let displayed = new Map<string, LngLat>();
  let glides = new Map<
    string,
    { from: LngLat; to: LngLat; startedAt: number; duration: number }
  >();
  let lastTargets = new Map<string, { position: LngLat; at: number }>();
  let frame: number | null = null;
  let hoveredKey: string | null = null;
  let clusterMaxZoom = 0;
  let lastDataAt = 0;
  let dataTimer: ReturnType<typeof setTimeout> | null = null;
  const styleTimers = new Set<ReturnType<typeof setTimeout>>();
  let contextCanvas: HTMLCanvasElement | null = null;
  let contextLostHandler: ((event: Event) => void) | null = null;
  const featureCache: VehicleFeatureCache = { features: new Map() };

  const listeners = new Map<keyof MapEvents, Set<(payload: never) => void>>();

  const capabilities: MapCapabilities = {
    offline: false,
    drawing: false,
    clustering: "native",
    // Measured 2026-11-05: a 5,000-vehicle target produced a 348 ms longest
    // pan task in Chromium, so the comfort budget stays well below that.
    comfortableVehicleCount: 1_000,
    styles,
  };

  function emit<K extends keyof MapEvents>(event: K, payload: MapEvents[K]): void {
    for (const listener of listeners.get(event) ?? []) {
      (listener as (value: MapEvents[K]) => void)(payload);
    }
  }

  function emitStyle(next: MapStyleState): void {
    styleState = next;
    emit("styleChange", next);
  }

  function source(id: string): GeoJSONSource | null {
    const found = map?.getSource(id);
    return found ? (found as GeoJSONSource) : null;
  }

  function fail(cause: unknown, fallback: string): void {
    if (!map) return;
    const error = cause instanceof MapError ? cause : new MapError(fallback);
    emit("error", normalize(error, { action: "load the map" }));
  }

  function applyData(
    id: string,
    data:
      | ReturnType<typeof geofenceCollection>
      | ReturnType<typeof vehicleCollection>
      | ReturnType<typeof routeCollection>,
  ): void {
    const target = source(id);
    if (target) {
      void target
        .setData(data)
        .catch((cause: unknown) => fail(cause, "The map data could not load"));
    }
  }

  function setVehicleData(): void {
    applyData(SOURCE_IDS.vehicles, vehicleCollection(vehicleTargets, displayed, featureCache));
  }

  function cancelDataTimer(): void {
    if (dataTimer !== null) {
      clearTimeout(dataTimer);
      dataTimer = null;
    }
  }

  function cancelStyleTimer(): void {
    for (const timer of styleTimers) clearTimeout(timer);
    styleTimers.clear();
  }

  /** Large fleets update the source at most 20 times per second. */
  function setVehicleDataSoon(): void {
    if (vehicleTargets.length <= capabilities.comfortableVehicleCount) {
      cancelDataTimer();
      setVehicleData();
      return;
    }

    const now = performance.now();
    const wait = HIGH_VOLUME_UPDATE_MS - (now - lastDataAt);
    if (wait <= 0) {
      cancelDataTimer();
      lastDataAt = now;
      setVehicleData();
      return;
    }
    if (dataTimer === null) {
      dataTimer = setTimeout(() => {
        dataTimer = null;
        lastDataAt = performance.now();
        setVehicleData();
      }, wait);
    }
  }

  function cancelAnimation(): void {
    if (frame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    frame = null;
  }

  function animateVehicles(): void {
    if (!map) return;
    const now = performance.now();
    for (const [key, glide] of glides) {
      const progress = glideProgress(glide.startedAt, now, glide.duration);
      displayed.set(key, lerpPosition(glide.from, glide.to, progress));
      if (progress >= 1) glides.delete(key);
    }
    setVehicleDataSoon();

    if (glides.size > 0 && typeof requestAnimationFrame === "function") {
      frame = requestAnimationFrame(animateVehicles);
    } else {
      frame = null;
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
    const imagery = baseStyle === "satellite";
    for (const layer of [
      ...geofenceLayers(tokens, { imagery }),
      ...routeLayers(tokens, { imagery }),
      ...vehicleLayers(tokens, { imagery }),
    ]) {
      if (!map.getLayer(layer.id)) map.addLayer(layer);
    }
  }

  function vehicleSourceSpec(styleTokens: MapTokens) {
    return {
      type: "geojson" as const,
      data: emptyCollection(),
      cluster: true,
      clusterRadius: styleTokens.marker.clusterRadius * 2,
      clusterMaxZoom: styleTokens.marker.clusterMaxZoom,
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
    };
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
      map.addSource(SOURCE_IDS.vehicles, vehicleSourceSpec(tokens));
      clusterMaxZoom = tokens.marker.clusterMaxZoom;
    }
    addLayers();
    applyAllData();
  }

  /**
   * Add our sources and layers to the new style before the swap. MapLibre then
   * applies the basemap and the operational layers together, so a style change
   * never shows an empty operational map while tiles arrive.
   */
  function composeStyle(base: StyleSpecification, id: MapStyleId): StyleSpecification {
    if (!tokens) return base;
    const imagery = id === "satellite";
    return {
      ...base,
      sources: {
        ...base.sources,
        [SOURCE_IDS.vehicles]: {
          ...vehicleSourceSpec(tokens),
          data: vehicleCollection(vehicleTargets, displayed, featureCache),
        },
        [SOURCE_IDS.geofences]: { type: "geojson", data: geofenceCollection(geofences) },
        [SOURCE_IDS.route]: { type: "geojson", data: routeCollection(route) },
      },
      layers: [
        ...base.layers,
        ...geofenceLayers(tokens, { imagery }),
        ...routeLayers(tokens, { imagery }),
        ...vehicleLayers(tokens, { imagery }),
      ],
    };
  }

  /** Only the standard style accepts the glyph override; hosted styles own theirs. */
  function applyGlyphs(instance: MapLibreMap, id: MapStyleId): void {
    if (id !== "standard" || mapConfig.glyphsUrl === "") return;
    instance.setGlyphs(mapConfig.glyphsUrl);
  }

  /** A fleet above the comfort budget clusters up to two zoom levels earlier. */
  function applyClusterOptions(): void {
    if (!map || !tokens) return;
    const next =
      vehicleTargets.length > capabilities.comfortableVehicleCount
        ? tokens.marker.clusterMaxZoom + 2
        : tokens.marker.clusterMaxZoom;
    if (next === clusterMaxZoom) return;

    const target = source(SOURCE_IDS.vehicles);
    if (!target) return;
    clusterMaxZoom = next;
    void target
      .setClusterOptions({
        cluster: true,
        clusterRadius: tokens.marker.clusterRadius * 2,
        clusterMaxZoom: next,
      })
      .catch((cause: unknown) => fail(cause, "The map clusters could not load"));
  }

  function refreshTokens(): void {
    if (!map || !tokens) return;
    installImages(map, tokens);
    removeLayers();
    addLayers();
    applyAllData();
  }

  function wireEvents(instance: MapLibreMap): void {
    instance.on("error", (event) => {
      if (instance !== map) return;
      const status = httpStatusOf(event);
      // The free plan pauses at its quota. One fallback, never a retry loop.
      if (
        (status === 403 || status === 429) &&
        isMapTilerStyleId(baseStyle) &&
        !fallbackInFlight
      ) {
        void fallBackToStandard(baseStyle, "quota");
        return;
      }
      const message = event.error?.message ?? "";
      // Glyph, sprite, tile and style failures degrade to a plainer basemap.
      // A style that cannot load at all is reported by waitForStyle instead.
      if (/glyph|sprite|tile|image|style/i.test(message)) return;
      fail(new MapError("The map could not load"), "The map could not load");
    });

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
            .catch((cause: unknown) => fail(cause, "The map cluster could not open"));
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
      bearing: instance.getBearing(),
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
    allowFallback: boolean,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        if (timer !== null) {
          clearTimeout(timer);
          styleTimers.delete(timer);
        }
        action();
      };
      const timer = setTimeout(() => {
        if (settled) return;
        if (!allowFallback || attempt > 0 || map !== instance) {
          finish(() => reject(new MapError("The map style could not load")));
          return;
        }
        instance.setStyle(fallbackStyle(theme, styleTokens));
        waitForStyle(instance, 1, styleTokens, false).then(
          () => finish(resolve),
          () => finish(() => reject(new MapError("The map style could not load"))),
        );
      }, STYLE_TIMEOUT_MS);
      styleTimers.add(timer);

      instance.once("style.load", () => finish(resolve));
    });
  }

  async function fallBackToStandard(
    failedStyle: MapStyleId,
    reason: MapStyleFailureReason,
  ): Promise<void> {
    if (!map || !tokens || fallbackInFlight) return;
    fallbackInFlight = true;
    const instance = map;
    const generation = ++styleGeneration;
    styleAbort?.abort();
    const abort = new AbortController();
    styleAbort = abort;
    baseStyle = "standard";
    currentAttribution = [];
    emitStyle({
      style: "standard",
      status: "error",
      attribution: null,
      failedStyle,
      reason,
    });

    try {
      const loaded = await loadStyle("standard", theme, mapTiler, abort.signal);
      if (map !== instance || generation !== styleGeneration) return;
      instance.setStyle(composeStyle(loaded.style, "standard"), { diff: false });
      await waitForStyle(instance, 0, tokens, true);
      if (map !== instance || generation !== styleGeneration) return;
      applyGlyphs(instance, "standard");
      installLayers();
      emitStyle({
        style: "standard",
        status: "ready",
        attribution: null,
        failedStyle,
        reason,
      });
    } catch (cause) {
      if (map !== instance || generation !== styleGeneration) return;
      emitStyle({ style: "standard", status: "error", attribution: null, failedStyle, reason });
      fail(cause, "The map style could not load");
    } finally {
      if (styleAbort === abort) styleAbort = null;
      fallbackInFlight = false;
    }
  }

  async function transitionTo(id: MapStyleId, nextTheme: "light" | "dark"): Promise<void> {
    if (!map || !tokens) return;
    const instance = map;
    const generation = ++styleGeneration;
    styleAbort?.abort();
    const abort = new AbortController();
    styleAbort = abort;
    emitStyle({
      style: baseStyle,
      status: "loading",
      attribution: currentAttribution.length > 0 ? currentAttribution : null,
      targetStyle: id,
    });

    try {
      const loaded = await loadStyle(id, nextTheme, mapTiler, abort.signal);
      if (map !== instance || generation !== styleGeneration) return;
      // The object is ready before the swap, so the old map stays visible while
      // the network portion of the change completes.
      instance.setStyle(composeStyle(loaded.style, id), { diff: false });
      await waitForStyle(instance, 0, tokens, id === "standard");
      if (map !== instance || generation !== styleGeneration) return;
      baseStyle = id;
      currentAttribution = isMapTilerStyleId(id) ? loaded.attribution : [];
      applyGlyphs(instance, id);
      installLayers();
      emitStyle({
        style: id,
        status: "ready",
        attribution: isMapTilerStyleId(id) ? loaded.attribution : null,
      });
    } catch (cause) {
      if (map !== instance || generation !== styleGeneration) return;
      if (id === "standard") {
        emitStyle({ style: "standard", status: "error", attribution: null });
        fail(cause, "The map style could not load");
        return;
      }
      const status = cause instanceof StyleLoadError ? cause.status : null;
      await fallBackToStandard(id, quotaReason(status) ?? "failed");
    } finally {
      if (styleAbort === abort) styleAbort = null;
    }
  }

  return {
    id: "maplibre",
    capabilities,

    async mount(element: HTMLElement, options: MountOptions): Promise<void> {
      if (map) throw new MapError("The map is already mounted");
      theme = options.theme;
      tokens = options.tokens;
      const bounds = options.bounds ?? mapConfig.defaultBounds;
      const requested =
        options.baseStyle && styles.includes(options.baseStyle) ? options.baseStyle : "standard";
      baseStyle = requested;

      const abort = new AbortController();
      styleAbort = abort;
      let loaded: LoadedBaseStyle | null = null;
      let failedStyle: MapStyleId | undefined;
      let failureReason: MapStyleFailureReason = "failed";
      try {
        loaded = await loadStyle(requested, theme, mapTiler, abort.signal);
      } catch (cause) {
        if (requested === "standard") {
          loaded = null;
        } else {
          failedStyle = requested;
          failureReason =
            quotaReason(cause instanceof StyleLoadError ? cause.status : null) ?? "failed";
          baseStyle = "standard";
          try {
            loaded = await loadStyle("standard", theme, mapTiler, abort.signal);
          } catch {
            loaded = null;
          }
        }
      }

      const instance = createMap({
        container: element,
        style: composeStyle(loaded?.style ?? fallbackStyle(theme, options.tokens), baseStyle),
        center: centerOf(bounds),
        zoom: 7,
        attributionControl: false,
        ...mapConfig.options,
      });
      map = instance;
      wireEvents(instance);

      contextCanvas = instance.getCanvas();
      const onContextLost = (event: Event) => {
        event.preventDefault();
        if (instance !== map) return;
        fail(
          new MapError("The map paused because its graphics context was lost"),
          "The map paused because its graphics context was lost",
        );
      };
      contextCanvas.addEventListener("webglcontextlost", onContextLost);
      contextLostHandler = onContextLost;

      try {
        await waitForStyle(instance, 0, options.tokens, baseStyle === "standard");
      } catch (cause) {
        if (map !== instance || !tokens) return;
        if (requested === "standard") throw cause;
        failedStyle = requested;
        failureReason = "failed";
        baseStyle = "standard";
        await fallBackToStandard(requested, failureReason);
      }
      if (map !== instance || !tokens) return;
      applyGlyphs(instance, baseStyle);
      installLayers();

      styleState = {
        style: baseStyle,
        status: "ready",
        attribution:
          isMapTilerStyleId(baseStyle) && loaded ? loaded.attribution : null,
        ...(failedStyle ? { failedStyle, reason: failureReason } : {}),
      };
      styleAbort = null;
      emit("ready", undefined);
    },

    destroy(): void {
      cancelAnimation();
      cancelDataTimer();
      cancelStyleTimer();
      styleAbort?.abort();
      styleAbort = null;
      if (contextCanvas && contextLostHandler) {
        contextCanvas.removeEventListener("webglcontextlost", contextLostHandler);
      }
      const instance = map;
      map = null;
      glides.clear();
      lastTargets.clear();
      displayed = new Map();
      featureCache.features.clear();
      clusterMaxZoom = 0;
      lastDataAt = 0;
      hoveredKey = null;
      currentAttribution = [];
      fallbackInFlight = false;
      contextCanvas = null;
      contextLostHandler = null;
      if (instance) instance.remove();
    },

    setTheme(nextTheme: "light" | "dark", nextTokens: MapTokens): void {
      tokens = nextTokens;
      if (!map) {
        theme = nextTheme;
        return;
      }

      if (nextTheme === theme) {
        refreshTokens();
        return;
      }
      theme = nextTheme;
      // Hybrid has no light/dark variants; the data layers carry the contrast.
      if (baseStyle === "satellite") {
        refreshTokens();
        return;
      }
      void transitionTo(baseStyle, nextTheme);
    },

    setBaseStyle(id: MapStyleId): void {
      if (!styles.includes(id)) return;
      if (id === baseStyle && styleState.status !== "loading") return;
      if (styleState.status === "loading" && styleState.style === id) return;
      void transitionTo(id, theme);
    },

    zoomIn(): void {
      map?.zoomIn();
    },

    zoomOut(): void {
      map?.zoomOut();
    },

    resetBearing(): void {
      map?.easeTo({ bearing: 0, animate: !prefersReducedMotion() });
    },

    setVehicles(vehicles: readonly MapVehicle[]): void {
      vehicleTargets = vehicles;
      if (!map) return;
      applyClusterOptions();

      const now = performance.now();
      const reducedMotion = prefersReducedMotion();
      const crowded = vehicles.length > capabilities.comfortableVehicleCount;
      const present = new Set(vehicles.map((vehicle) => vehicle.key));
      for (const key of displayed.keys()) if (!present.has(key)) displayed.delete(key);
      for (const key of glides.keys()) if (!present.has(key)) glides.delete(key);
      for (const key of lastTargets.keys()) if (!present.has(key)) lastTargets.delete(key);

      for (const vehicle of vehicles) {
        const last = lastTargets.get(vehicle.key);
        const changed =
          !last ||
          last.position[0] !== vehicle.position[0] ||
          last.position[1] !== vehicle.position[1];
        if (!changed) continue;
        lastTargets.set(vehicle.key, { position: vehicle.position, at: now });

        const from = displayed.get(vehicle.key);
        const duration = last ? glideDuration(last.at, now, reducedMotion) : 0;
        if (!from || crowded || duration <= 0 || typeof requestAnimationFrame !== "function") {
          displayed.set(vehicle.key, vehicle.position);
          glides.delete(vehicle.key);
          continue;
        }

        glides.set(vehicle.key, {
          from,
          to: vehicle.position,
          startedAt: now,
          duration,
        });
      }

      setVehicleDataSoon();
      if (glides.size > 0 && frame === null && typeof requestAnimationFrame === "function") {
        frame = requestAnimationFrame(animateVehicles);
      }
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

    flyTo(point: LngLat, zoom?: number, options?: { padding?: Padding }): void {
      if (!map) return;
      map.flyTo({
        center: point,
        ...(zoom !== undefined ? { zoom } : {}),
        ...(options?.padding ? { padding: options.padding } : {}),
        animate: !prefersReducedMotion(),
      });
    },

    getStyleState(): MapStyleState {
      return { ...styleState };
    },

    getViewport(): Viewport {
      if (!map) {
        return {
          center: [0, 0],
          zoom: 0,
          bearing: 0,
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

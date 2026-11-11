import { availableMapStyles } from "../config";
import type {
  Bounds,
  DrawController,
  LngLat,
  MapAdapter,
  MapCapabilities,
  MapEvents,
  MapGeofence,
  MapRoute,
  MapStyleId,
  MapStyleState,
  MapTokens,
  MapVehicle,
  MountOptions,
  Padding,
  Viewport,
} from "../types";
import type { GeofenceKind, Polygon } from "../../api/types";
import { MapError } from "../../errors/types";
import { repairRing } from "../geofences";

export const FAKE_MAPTILER_ATTRIBUTION = "© MapTiler © OpenStreetMap contributors";

function isHostedStyle(id: MapStyleId): boolean {
  return id === "streets" || id === "satellite";
}

function attributionFor(id: MapStyleId): readonly string[] | null {
  return isHostedStyle(id) ? [FAKE_MAPTILER_ATTRIBUTION] : null;
}

const MIN_ZOOM = 2;
const MAX_ZOOM = 18;

const WORLD: Bounds = { south: -85, west: -180, north: 85, east: 180 };

export interface FakeCluster {
  id: string;
  count: number;
  position: LngLat;
  worstStatus: MapVehicle["status"];
}

const statusRank: Record<MapVehicle["status"], number> = {
  alert: 0,
  moving: 1,
  idle: 2,
  offline: 3,
};

export interface FakeAdapterOptions {
  styles?: readonly MapStyleId[];
}

function polygonFromRing(ring: readonly LngLat[]): Polygon | null {
  const repaired = repairRing(ring);
  return repaired ? { type: "Polygon", coordinates: [repaired] } : null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches("input, select, textarea") || target.isContentEditable === true)
  );
}

/** Deterministic drawing controller: clicks add vertices, keys close, remove and cancel. */
class FakeDrawController implements DrawController {
  private active = false;
  private vertices: LngLat[] = [];
  private geometry: Polygon | null = null;
  private readonly listeners = new Set<(geometry: Polygon | null) => void>();
  private readonly getElement: () => HTMLElement | null;
  private readonly getViewport: () => Viewport;

  constructor(getElement: () => HTMLElement | null, getViewport: () => Viewport) {
    this.getElement = getElement;
    this.getViewport = getViewport;
  }

  async start(_kind: GeofenceKind, ring?: LngLat[]): Promise<void> {
    this.active = true;
    this.vertices = ring ? [...ring] : [];
    this.geometry = ring ? polygonFromRing(ring) : null;
    this.getElement()?.addEventListener("click", this.handleClick);
    this.getElement()?.addEventListener("keydown", this.handleKey);
    this.emit(this.geometry);
  }

  stop(): void {
    this.active = false;
    this.detach();
  }

  cancel(): void {
    this.active = false;
    this.vertices = [];
    this.geometry = null;
    this.detach();
    this.emit(null);
  }

  getGeometry(): Polygon | null {
    return this.geometry;
  }

  onChange(listener: (geometry: Polygon | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Test seam: add a vertex without a browser click. */
  testAddVertex(point: LngLat): void {
    if (!this.active) return;
    this.vertices.push(point);
  }

  /** Test seam for the edit flow: replace the working ring. */
  testSetRing(ring: readonly LngLat[]): void {
    const polygon = polygonFromRing(ring);
    if (!polygon) return;
    this.vertices = [...ring];
    this.geometry = polygon;
    this.emit(polygon);
  }

  dispose(): void {
    this.active = false;
    this.detach();
    this.listeners.clear();
  }

  private close(): boolean {
    const polygon = polygonFromRing(this.vertices);
    if (!polygon) return false;
    this.geometry = polygon;
    this.emit(polygon);
    return true;
  }

  private emit(geometry: Polygon | null): void {
    for (const listener of this.listeners) listener(geometry);
  }

  private readonly handleKey = (event: KeyboardEvent): void => {
    if (!this.active || isTypingTarget(event.target)) return;
    if (event.key === "Enter") {
      if (this.close()) event.preventDefault();
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      this.vertices.pop();
      if (this.vertices.length < 3) {
        this.geometry = null;
        this.emit(null);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      this.cancel();
    }
  };

  private readonly handleClick = (event: MouseEvent): void => {
    if (!this.active) return;
    const element = this.getElement();
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const first = this.vertices[0];
    if (first && this.vertices.length >= 3 && this.nearFirst(event, rect, first)) {
      this.close();
      return;
    }
    this.vertices.push(this.toLngLat(event, rect));
  };

  private nearFirst(event: MouseEvent, rect: DOMRect, first: LngLat): boolean {
    const { bounds } = this.getViewport();
    const width = bounds.east - bounds.west;
    const height = bounds.north - bounds.south;
    if (width === 0 || height === 0) return false;
    const x = rect.left + ((first[0] - bounds.west) / width) * rect.width;
    const y = rect.top + ((bounds.north - first[1]) / height) * rect.height;
    return Math.hypot(event.clientX - x, event.clientY - y) <= 12;
  }

  private toLngLat(event: MouseEvent, rect: DOMRect): LngLat {
    const { bounds } = this.getViewport();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return [
      bounds.west + x * (bounds.east - bounds.west),
      bounds.north - y * (bounds.north - bounds.south),
    ];
  }

  private detach(): void {
    this.getElement()?.removeEventListener("click", this.handleClick);
    this.getElement()?.removeEventListener("keydown", this.handleKey);
  }
}

export class FakeAdapter implements MapAdapter {
  readonly id = "fake";
  readonly capabilities: MapCapabilities;

  constructor(options: FakeAdapterOptions = {}) {
    this.capabilities = {
      offline: true,
      drawing: true,
      clustering: "emulated",
      comfortableVehicleCount: 5_000,
      styles: options.styles ?? availableMapStyles,
    };
  }

  mounted = false;
  theme: "light" | "dark" = "light";
  tokens: MapTokens | null = null;
  baseStyle: MapStyleId = "standard";
  vehicles: readonly MapVehicle[] = [];
  clusters: readonly FakeCluster[] = [];
  geofences: readonly MapGeofence[] = [];
  route: MapRoute | null = null;
  flyPadding: Padding | null = null;
  viewport: Viewport = { center: [0, 0], zoom: 2, bearing: 0, bounds: WORLD };
  mountCount = 0;
  destroyCount = 0;
  element: HTMLElement | null = null;
  private clusterMaxZoom = 10;
  private clusterRadius = 22;
  private controller: FakeDrawController | null = null;

  get draw(): DrawController {
    this.controller ??= new FakeDrawController(
      () => this.element,
      () => this.viewport,
    );
    return this.controller;
  }

  private readonly listeners = new Map<keyof MapEvents, Set<(payload: never) => void>>();

  mount(element: HTMLElement, options: MountOptions): Promise<void> {
    this.mounted = true;
    this.mountCount += 1;
    this.element = element;
    this.theme = options.theme;
    this.tokens = options.tokens;
    this.baseStyle = options.baseStyle ?? "standard";
    this.clusterMaxZoom = options.tokens.marker.clusterMaxZoom;
    this.clusterRadius = options.tokens.marker.clusterRadius;
    if (options.bounds) {
      this.viewport = {
        center: [
          (options.bounds.west + options.bounds.east) / 2,
          (options.bounds.south + options.bounds.north) / 2,
        ],
        zoom: 8,
        bearing: this.viewport.bearing,
        bounds: options.bounds,
      };
    }
    this.recomputeClusters();
    queueMicrotask(() => this.emit("ready", undefined));
    return Promise.resolve();
  }

  destroy(): void {
    this.controller?.dispose();
    this.controller = null;
    this.mounted = false;
    this.element = null;
    this.destroyCount += 1;
  }

  setTheme(theme: "light" | "dark", tokens: MapTokens): void {
    this.theme = theme;
    this.tokens = tokens;
    this.clusterMaxZoom = tokens.marker.clusterMaxZoom;
    this.clusterRadius = tokens.marker.clusterRadius;
    this.recomputeClusters();
  }

  setVehicles(vehicles: readonly MapVehicle[]): void {
    this.vehicles = vehicles;
    this.recomputeClusters();
  }

  setGeofences(geofences: readonly MapGeofence[]): void {
    this.geofences = geofences;
  }

  setRoute(route: MapRoute | null): void {
    this.route = route;
  }

  fitBounds(bounds: Bounds, _options?: { padding?: Padding; animate?: boolean }): void {
    this.viewport = {
      center: [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2],
      zoom: 10,
      bearing: this.viewport.bearing,
      bounds,
    };
    this.recomputeClusters();
    this.emit("viewportChange", this.viewport);
  }

  flyTo(point: LngLat, zoom?: number, options?: { padding?: Padding }): void {
    this.flyPadding = options?.padding ?? null;
    this.viewport = { ...this.viewport, center: point, zoom: zoom ?? this.viewport.zoom };
    this.recomputeClusters();
    this.emit("viewportChange", this.viewport);
  }

  zoomIn(): void {
    this.setZoom(this.viewport.zoom + 1);
  }

  zoomOut(): void {
    this.setZoom(this.viewport.zoom - 1);
  }

  resetBearing(): void {
    this.viewport = { ...this.viewport, bearing: 0 };
    this.emit("viewportChange", this.viewport);
  }

  setBaseStyle(id: MapStyleId): void {
    if (!this.capabilities.styles.includes(id)) return;
    this.emit("styleChange", {
      style: this.baseStyle,
      status: "loading",
      attribution: attributionFor(this.baseStyle),
      targetStyle: id,
    });
    this.baseStyle = id;
    this.emit("styleChange", {
      style: id,
      status: "ready",
      attribution: attributionFor(id),
    });
  }

  getStyleState(): MapStyleState {
    return {
      style: this.baseStyle,
      status: "ready",
      attribution: attributionFor(this.baseStyle),
    };
  }

  getViewport(): Viewport {
    return this.viewport;
  }

  private setZoom(zoom: number): void {
    this.viewport = {
      ...this.viewport,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)),
    };
    this.recomputeClusters();
    this.emit("viewportChange", this.viewport);
  }

  private recomputeClusters(): void {
    if (this.viewport.zoom >= this.clusterMaxZoom) {
      this.clusters = [];
      return;
    }

    const cell = (this.clusterRadius * 360) / (256 * 2 ** this.viewport.zoom);
    const groups = new Map<string, MapVehicle[]>();
    for (const vehicle of this.vehicles) {
      const [lon, lat] = vehicle.position;
      const key = `${Math.floor(lon / cell)}:${Math.floor(lat / cell)}`;
      const group = groups.get(key) ?? [];
      group.push(vehicle);
      groups.set(key, group);
    }

    this.clusters = [...groups.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([key, group]) => {
        const position = group.reduce<LngLat>(
          (sum, vehicle) => [sum[0] + vehicle.position[0], sum[1] + vehicle.position[1]],
          [0, 0],
        );
        const worstStatus = group.reduce<MapVehicle["status"]>(
          (worst, vehicle) => (statusRank[vehicle.status] < statusRank[worst] ? vehicle.status : worst),
          "offline",
        );
        return {
          id: `cluster:${key}`,
          count: group.length,
          position: [position[0] / group.length, position[1] / group.length],
          worstStatus,
        };
      });
  }

  on<K extends keyof MapEvents>(event: K, listener: (payload: MapEvents[K]) => void): () => void {
    const listeners = this.listeners.get(event) ?? new Set<(payload: never) => void>();
    listeners.add(listener as (payload: never) => void);
    this.listeners.set(event, listeners);
    return () => {
      listeners.delete(listener as (payload: never) => void);
    };
  }

  emit<K extends keyof MapEvents>(event: K, payload: MapEvents[K]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      (listener as (value: MapEvents[K]) => void)(payload);
    }
  }
}

/** Deterministic adapter failure for the e2e fault matrix. Only loaded in dev mock mode. */
export class BrokenAdapter extends FakeAdapter {
  override mount(): Promise<void> {
    return Promise.reject(new MapError("Injected adapter failure"));
  }
}

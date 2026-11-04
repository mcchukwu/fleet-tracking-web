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
} from "../types";

const WORLD: Bounds = { south: -85, west: -180, north: 85, east: 180 };

export class FakeAdapter implements MapAdapter {
  readonly id = "fake";
  readonly capabilities: MapCapabilities = {
    offline: true,
    drawing: false,
    clustering: "emulated",
    comfortableVehicleCount: 5_000,
  };

  mounted = false;
  theme: "light" | "dark" = "light";
  tokens: MapTokens | null = null;
  vehicles: readonly MapVehicle[] = [];
  geofences: readonly MapGeofence[] = [];
  route: MapRoute | null = null;
  viewport: Viewport = { center: [0, 0], zoom: 2, bounds: WORLD };
  mountCount = 0;
  destroyCount = 0;

  private readonly listeners = new Map<keyof MapEvents, Set<(payload: never) => void>>();

  mount(_element: HTMLElement, options: MountOptions): Promise<void> {
    this.mounted = true;
    this.mountCount += 1;
    this.theme = options.theme;
    this.tokens = options.tokens;
    if (options.bounds) {
      this.viewport = {
        center: [
          (options.bounds.west + options.bounds.east) / 2,
          (options.bounds.south + options.bounds.north) / 2,
        ],
        zoom: 8,
        bounds: options.bounds,
      };
    }
    queueMicrotask(() => this.emit("ready", undefined));
    return Promise.resolve();
  }

  destroy(): void {
    this.mounted = false;
    this.destroyCount += 1;
  }

  setTheme(theme: "light" | "dark", tokens: MapTokens): void {
    this.theme = theme;
    this.tokens = tokens;
  }

  setVehicles(vehicles: readonly MapVehicle[]): void {
    this.vehicles = vehicles;
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
      bounds,
    };
    this.emit("viewportChange", this.viewport);
  }

  flyTo(point: LngLat, zoom?: number): void {
    this.viewport = { ...this.viewport, center: point, zoom: zoom ?? this.viewport.zoom };
    this.emit("viewportChange", this.viewport);
  }

  getViewport(): Viewport {
    return this.viewport;
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

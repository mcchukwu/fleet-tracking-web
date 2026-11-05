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
import { MapError } from "../../errors/types";

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

export class FakeAdapter implements MapAdapter {  readonly id = "fake";
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
  clusters: readonly FakeCluster[] = [];
  geofences: readonly MapGeofence[] = [];
  route: MapRoute | null = null;
  viewport: Viewport = { center: [0, 0], zoom: 2, bounds: WORLD };
  mountCount = 0;
  destroyCount = 0;
  private clusterMaxZoom = 10;
  private clusterRadius = 22;

  private readonly listeners = new Map<keyof MapEvents, Set<(payload: never) => void>>();

  mount(_element: HTMLElement, options: MountOptions): Promise<void> {
    this.mounted = true;
    this.mountCount += 1;
    this.theme = options.theme;
    this.tokens = options.tokens;
    this.clusterMaxZoom = options.tokens.marker.clusterMaxZoom;
    this.clusterRadius = options.tokens.marker.clusterRadius;
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
    this.recomputeClusters();
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
      bounds,
    };
    this.recomputeClusters();
    this.emit("viewportChange", this.viewport);
  }

  flyTo(point: LngLat, zoom?: number): void {
    this.viewport = { ...this.viewport, center: point, zoom: zoom ?? this.viewport.zoom };
    this.recomputeClusters();
    this.emit("viewportChange", this.viewport);
  }

  getViewport(): Viewport {
    return this.viewport;
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

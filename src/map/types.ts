import type { GeofenceKind, Polygon } from "../api/types";
import type { VehicleDisplayStatus } from "../lib/status";
import type { AppError } from "../errors/types";

export type LngLat = [number, number];

export type MapStyleId = "standard" | "streets" | "satellite";

export type MapStyleFailureReason = "failed" | "quota";

export interface MapStyleState {
  style: MapStyleId;
  status: "loading" | "ready" | "error";
  attribution: readonly string[] | null;
  targetStyle?: MapStyleId;
  failedStyle?: MapStyleId;
  reason?: MapStyleFailureReason;
}

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Viewport {
  center: LngLat;
  zoom: number;
  bearing: number;
  bounds: Bounds;
}

export interface MapVehicle {
  key: string;
  position: LngLat;
  headingDeg: number | null;
  status: VehicleDisplayStatus;
  label: string;
  selected: boolean;
  hovered: boolean;
  stale: boolean;
}

export interface MapGeofence {
  id: string;
  name: string;
  kind: GeofenceKind;
  rings: LngLat[][];
  highlighted: boolean;
}

export interface MapRoute {
  points: LngLat[];
  gapAfterIndex: number[];
  cursorIndex: number | null;
  /** Prepared cursor position; a provider renders it without knowing the clock. */
  cursorPosition: LngLat | null;
  chevrons: boolean;
}

export interface MapCapabilities {
  offline: boolean;
  drawing: boolean;
  clustering: "native" | "emulated";
  comfortableVehicleCount: number;
  styles: readonly MapStyleId[];
}

export interface MapTokens {
  colors: {
    surface: string;
    text: string;
    textMuted: string;
    textInverse: string;
    accent: string;
    moving: string;
    idle: string;
    offline: string;
    alert: string;
    geofenceDepot: string;
    geofenceCustomer: string;
    geofenceRestricted: string;
    geofenceOther: string;
  };
  fonts: {
    ui: string;
    data: string;
  };
  marker: {
    radius: number;
    ringWidth: number;
    hitRadius: number;
    selectedRadius: number;
    selectedRingWidth: number;
    hoverRingWidth: number;
    glyphSize: number;
    labelZoom: number;
    labelSize: number;
    labelOffset: number;
    clusterZoom: number;
    clusterRadius: number;
    clusterMaxZoom: number;
    clusterTextSize: number;
  };
  geofence: {
    fillOpacity: number;
    strokeWidth: number;
    labelZoom: number;
    labelSize: number;
  };
  route: {
    lineWidth: number;
    chevronSpacing: number;
    cursorRadius: number;
    pinRadius: number;
    pinRingWidth: number;
    labelZoom: number;
    labelSize: number;
  };
  onImagery: {
    haloWidth: number;
    haloColor: string;
  };
}

export interface DrawController {
  start(kind: GeofenceKind, ring?: LngLat[]): void;
  stop(): void;
  getGeometry(): Polygon | null;
  onChange(listener: (geometry: Polygon | null) => void): () => void;
}

export interface MapEvents {
  ready: undefined;
  error: AppError;
  viewportChange: Viewport;
  vehicleClick: { key: string };
  vehicleHover: { key: string; point: { x: number; y: number } } | null;
  clusterClick: { clusterId: string; count: number };
  geofenceClick: { id: string };
  mapClick: { point: LngLat };
  styleChange: MapStyleState;
}

export interface MountOptions {
  theme: "light" | "dark";
  tokens: MapTokens;
  bounds?: Bounds;
  baseStyle?: MapStyleId;
}

export interface MapAdapter {
  readonly id: string;
  readonly capabilities: MapCapabilities;
  mount(element: HTMLElement, options: MountOptions): Promise<void>;
  destroy(): void;
  setTheme(theme: "light" | "dark", tokens: MapTokens): void;
  setVehicles(vehicles: readonly MapVehicle[]): void;
  setGeofences(geofences: readonly MapGeofence[]): void;
  setRoute(route: MapRoute | null): void;
  fitBounds(bounds: Bounds, options?: { padding?: Padding; animate?: boolean }): void;
  flyTo(point: LngLat, zoom?: number, options?: { padding?: Padding }): void;
  zoomIn(): void;
  zoomOut(): void;
  resetBearing(): void;
  setBaseStyle(id: MapStyleId): void;
  getStyleState(): MapStyleState;
  getViewport(): Viewport;
  on<K extends keyof MapEvents>(event: K, listener: (payload: MapEvents[K]) => void): () => void;
  readonly draw?: DrawController;
}

export type MapProvider = "maplibre" | "google" | "fake";

export const identityBounds = (point: LngLat): Bounds => ({
  south: point[1],
  west: point[0],
  north: point[1],
  east: point[0],
});

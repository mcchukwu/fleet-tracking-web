import type { Bounds } from "../map/types";

export interface FleetDebugMapState {
  mapLoaded: boolean;
  provider: string | null;
  renderedVehicleCount: number;
  viewport: { center: [number, number]; zoom: number } | null;
  bounds: Bounds | null;
  selectedKey: string | null;
  hoveredKey: string | null;
  fitBounds: Bounds | null;
  fitCount: number;
  geofenceCount: number;
}

export interface FleetDebugLivePosition {
  lat: number;
  lon: number;
  recordedAt: string;
  positionAt: number;
  speedKph: number | null;
  headingDeg: number | null;
  alertMarkedAt: number | null;
}

export interface FleetDebugLiveState {
  positions: Record<string, FleetDebugLivePosition>;
  version: number;
  frameCount: number;
  batchCount: number;
  unknownKeys: number;
}

export interface FleetDebugSnapshot {
  live: FleetDebugLiveState;
  connection: {
    network: "online" | "offline";
    socket: "live" | "reconnecting" | "down";
    lastDataAt: number | null;
    socketDownAt: number | null;
  };
  map: FleetDebugMapState;
}

type DebugReader = () => FleetDebugSnapshot;

const emptyMapState: FleetDebugMapState = {
  mapLoaded: false,
  provider: null,
  renderedVehicleCount: 0,
  viewport: null,
  bounds: null,
  selectedKey: null,
  hoveredKey: null,
  fitBounds: null,
  fitCount: 0,
  geofenceCount: 0,
};

let reader: DebugReader | null = null;
let mapState: FleetDebugMapState = { ...emptyMapState };

export function setMapDebug(patch: Partial<FleetDebugMapState>): void {
  if (!import.meta.env.DEV) return;
  mapState = { ...mapState, ...patch };
}

export function resetMapDebug(): void {
  mapState = { ...emptyMapState };
}

export function readMapDebug(): FleetDebugMapState {
  return mapState;
}

export function registerDebugSnapshot(next: DebugReader): () => void {
  if (!import.meta.env.DEV) return () => undefined;
  reader = next;
  Object.defineProperty(window, "__FLEET_DEBUG__", {
    configurable: true,
    enumerable: false,
    get: () => (reader ? reader() : null),
  });
  return () => {
    reader = null;
    Reflect.deleteProperty(window, "__FLEET_DEBUG__");
  };
}

export function readDebugSnapshot(): FleetDebugSnapshot | null {
  return reader ? reader() : null;
}

declare global {
  interface Window {
    __FLEET_DEBUG__?: FleetDebugSnapshot | null;
  }
}

import type { Bounds, MapAdapter } from "../map/types";

export interface FleetDebugMapState {
  mapLoaded: boolean;
  provider: string | null;
  targetVehicleCount: number;
  viewport: { center: [number, number]; zoom: number; bearing: number } | null;
  bounds: Bounds | null;
  bearing: number | null;
  baseStyle: string | null;
  styleState: "loading" | "ready" | "error" | null;
  activeStyle: string | null;
  selectedKey: string | null;
  hoveredKey: string | null;
  fitBounds: Bounds | null;
  fitCount: number;
  geofenceCount: number;
  stale: boolean;
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
  playback: FleetDebugPlaybackState;
}

export interface FleetDebugPlaybackState {
  vehicleId: string | null;
  from: string | null;
  to: string | null;
  resolution: string | null;
  pointCount: number;
  gapCount: number;
  eventCount: number;
  cursorIndex: number | null;
  cursorPosition: [number, number] | null;
  playheadMs: number | null;
  playing: boolean;
  speed: number;
  inGap: boolean;
  cancelled: boolean;
  reducedMotion: boolean;
}

type DebugReader = () => FleetDebugSnapshot;

const emptyMapState: FleetDebugMapState = {
  mapLoaded: false,
  provider: null,
  targetVehicleCount: 0,
  viewport: null,
  bounds: null,
  bearing: null,
  baseStyle: null,
  styleState: null,
  activeStyle: null,
  selectedKey: null,
  hoveredKey: null,
  fitBounds: null,
  fitCount: 0,
  geofenceCount: 0,
  stale: false,
};

let reader: DebugReader | null = null;
let mapState: FleetDebugMapState = { ...emptyMapState };

const emptyPlaybackState: FleetDebugPlaybackState = {
  vehicleId: null,
  from: null,
  to: null,
  resolution: null,
  pointCount: 0,
  gapCount: 0,
  eventCount: 0,
  cursorIndex: null,
  cursorPosition: null,
  playheadMs: null,
  playing: false,
  speed: 1,
  inGap: false,
  cancelled: false,
  reducedMotion: false,
};

let playbackState: FleetDebugPlaybackState = { ...emptyPlaybackState };

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

export function setPlaybackDebug(patch: Partial<FleetDebugPlaybackState>): void {
  if (!import.meta.env.DEV) return;
  playbackState = { ...playbackState, ...patch };
}

export function resetPlaybackDebug(): void {
  playbackState = { ...emptyPlaybackState };
}

export function readPlaybackDebug(): FleetDebugPlaybackState {
  return playbackState;
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
    /** Dev-and-mock only: camera access for review screenshots. */
    __FLEET_TEST_MAP__?: MapAdapter | null;
  }
}

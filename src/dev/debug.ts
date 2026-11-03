export interface FleetDebugMapState {
  mapLoaded: boolean;
  renderedVehicleCount: number;
  viewport: { center: [number, number]; zoom: number } | null;
}

export interface FleetDebugSnapshot {
  live: Record<string, unknown>;
  connection: {
    network: "online" | "offline";
    socket: "live" | "reconnecting" | "down";
    lastDataAt: number | null;
  };
  map: FleetDebugMapState;
}

type DebugReader = () => FleetDebugSnapshot;

let reader: DebugReader | null = null;

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

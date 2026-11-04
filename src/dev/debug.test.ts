import { describe, expect, it } from "vitest";
import { readDebugSnapshot, registerDebugSnapshot, type FleetDebugSnapshot } from "./debug";

const snapshot: FleetDebugSnapshot = {
  live: { positions: {}, version: 0, frameCount: 0, batchCount: 0, unknownKeys: 0 },
  connection: { network: "online", socket: "down", lastDataAt: null, socketDownAt: null },
  map: {
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
  },
};

describe("debug hook", () => {
  it("exposes a read-only snapshot and removes it on cleanup", () => {
    const cleanup = registerDebugSnapshot(() => snapshot);
    expect(window.__FLEET_DEBUG__).toEqual(snapshot);
    expect(readDebugSnapshot()).toEqual(snapshot);

    cleanup();
    expect(window.__FLEET_DEBUG__).toBeUndefined();
    expect(readDebugSnapshot()).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { readDebugSnapshot, registerDebugSnapshot, type FleetDebugSnapshot } from "./debug";

const snapshot: FleetDebugSnapshot = {
  live: {},
  connection: { network: "online", socket: "down", lastDataAt: null },
  map: { mapLoaded: false, renderedVehicleCount: 0, viewport: null },
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

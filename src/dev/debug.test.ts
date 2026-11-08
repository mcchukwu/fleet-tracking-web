import { describe, expect, it } from "vitest";
import {
  readDebugSnapshot,
  readPlaybackDebug,
  registerDebugSnapshot,
  resetPlaybackDebug,
  setPlaybackDebug,
  type FleetDebugSnapshot,
} from "./debug";

const snapshot: FleetDebugSnapshot = {
  live: { positions: {}, version: 0, frameCount: 0, batchCount: 0, unknownKeys: 0 },
  connection: { network: "online", socket: "down", lastDataAt: null, socketDownAt: null },
  map: {
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
  },
  playback: {
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

  it("exposes and resets the playback snapshot", () => {
    setPlaybackDebug({ pointCount: 12, playing: true, speed: 4 });
    expect(readPlaybackDebug()).toMatchObject({ pointCount: 12, playing: true, speed: 4 });

    resetPlaybackDebug();
    expect(readPlaybackDebug()).toMatchObject({ pointCount: 0, playing: false, speed: 1 });
  });
});

import { describe, expect, it, vi } from "vitest";
import type { MapAdapter, MapTokens } from "../types";

export const contractTokens: MapTokens = {
  colors: {
    surface: "surface-token",
    text: "text-token",
    textMuted: "muted-token",
    textInverse: "inverse-token",
    accent: "accent-token",
    moving: "moving-token",
    idle: "idle-token",
    offline: "offline-token",
    alert: "alert-token",
    geofenceDepot: "depot-token",
    geofenceCustomer: "customer-token",
    geofenceRestricted: "restricted-token",
    geofenceOther: "other-token",
  },
  basemap: {
    background: "basemap-background",
    earth: "basemap-earth",
    water: "basemap-water",
    park: "basemap-park",
    building: "basemap-building",
    road: "basemap-road",
    roadMinor: "basemap-road-minor",
    boundary: "basemap-boundary",
    label: "basemap-label",
    labelHalo: "basemap-label-halo",
  },
  fonts: { ui: "ui-token", data: "data-token" },
  marker: {
    radius: 12,
    ringWidth: 2,
    hitRadius: 22,
    selectedRadius: 16,
    selectedRingWidth: 2,
    hoverRingWidth: 1,
    glyphSize: 12,
    labelZoom: 13,
    labelSize: 12,
    labelOffset: 1,
    clusterZoom: 11,
    clusterRadius: 22,
    clusterMaxZoom: 10,
    clusterTextSize: 12,
  },
  geofence: { fillOpacity: 0.12, strokeWidth: 2, labelZoom: 12, labelSize: 12 },
  route: {
    lineWidth: 3,
    chevronSpacing: 80,
    cursorRadius: 7,
    pinRadius: 5,
    pinRingWidth: 2,
    labelZoom: 12,
    labelSize: 12,
  },
  onImagery: { haloWidth: 2, haloColor: "halo-token" },
};

export interface AdapterContractOptions {
  create: () => MapAdapter;
}

export function runAdapterContract(name: string, options: AdapterContractOptions): void {
  describe(`${name} adapter contract`, () => {
    it("declares honest capabilities", () => {
      const adapter = options.create();
      expect(adapter.id.length).toBeGreaterThan(0);
      expect(typeof adapter.capabilities.offline).toBe("boolean");
      expect(typeof adapter.capabilities.drawing).toBe("boolean");
      expect(["native", "emulated"]).toContain(adapter.capabilities.clustering);
      expect(adapter.capabilities.comfortableVehicleCount).toBeGreaterThan(0);
      expect(adapter.capabilities.styles).toContain("standard");
      expect(adapter.getStyleState().style).toBe("standard");
      expect(Boolean(adapter.draw)).toBe(adapter.capabilities.drawing);
      adapter.destroy();
    });

    it("starts drawing asynchronously and cancels back to no geometry", async () => {
      const adapter = options.create();
      await adapter.mount(document.createElement("div"), {
        theme: "light",
        tokens: contractTokens,
        bounds: { south: 6, west: 3, north: 7, east: 4 },
      });
      const draw = adapter.draw;
      if (!adapter.capabilities.drawing || !draw) {
        expect(adapter.capabilities.drawing).toBe(false);
        expect(draw).toBeUndefined();
        adapter.destroy();
        return;
      }

      const changes: unknown[] = [];
      const unsubscribe = draw.onChange((geometry) => changes.push(geometry));
      await draw.start("depot", [
        [3.4, 6.4],
        [3.5, 6.4],
        [3.5, 6.5],
      ]);
      expect(draw.getGeometry()).not.toBeNull();

      draw.cancel();
      expect(draw.getGeometry()).toBeNull();
      expect(changes[changes.length - 1]).toBeNull();
      unsubscribe();
      adapter.destroy();
    });

    it("mounts, emits ready and reports a viewport", async () => {
      const adapter = options.create();
      const ready = vi.fn();
      adapter.on("ready", ready);
      const element = document.createElement("div");
      await adapter.mount(element, {
        theme: "light",
        tokens: contractTokens,
        bounds: { south: 6, west: 3, north: 7, east: 4 },
      });
      await Promise.resolve();
      expect(ready).toHaveBeenCalled();
      const viewport = adapter.getViewport();
      expect(Number.isFinite(viewport.center[0])).toBe(true);
      expect(Number.isFinite(viewport.center[1])).toBe(true);
      expect(viewport.zoom).toBeGreaterThan(0);
      expect(Number.isFinite(viewport.bearing)).toBe(true);
      adapter.destroy();
    });

    it("zooms through the contract and resets the bearing", async () => {
      const adapter = options.create();
      await adapter.mount(document.createElement("div"), {
        theme: "light",
        tokens: contractTokens,
        bounds: { south: 6, west: 3, north: 7, east: 4 },
        baseStyle: "standard",
      });
      const zoom = adapter.getViewport().zoom;

      adapter.zoomIn();
      expect(adapter.getViewport().zoom).toBeGreaterThan(zoom);
      adapter.zoomOut();
      adapter.zoomOut();
      expect(adapter.getViewport().zoom).toBeLessThan(zoom);

      adapter.resetBearing();
      expect(adapter.getViewport().bearing).toBe(0);
      adapter.destroy();
    });

    it("accepts a supported base style and ignores an unavailable one", async () => {
      const adapter = options.create();
      await adapter.mount(document.createElement("div"), {
        theme: "light",
        tokens: contractTokens,
        baseStyle: "standard",
      });

      expect(() => adapter.setBaseStyle("standard")).not.toThrow();
      if (adapter.capabilities.styles.includes("satellite")) {
        adapter.setBaseStyle("satellite");
      } else {
        expect(() => adapter.setBaseStyle("satellite")).not.toThrow();
      }
      adapter.destroy();
    });

    it("accepts domain state without exposing an SDK", async () => {
      const adapter = options.create();
      await adapter.mount(document.createElement("div"), {
        theme: "dark",
        tokens: contractTokens,
      });
      adapter.setVehicles([
        {
          key: "demo-imei-0001",
          position: [3.4, 6.5],
          headingDeg: 90,
          status: "moving",
          label: "LSD-100-AA",
          selected: false,
          hovered: false,
          stale: false,
        },
      ]);
      adapter.setGeofences([
        {
          id: "gf-1",
          name: "Depot",
          kind: "depot",
          rings: [[[3.4, 6.5], [3.5, 6.5], [3.5, 6.6], [3.4, 6.5]]],
          highlighted: false,
        },
      ]);
      adapter.setRoute({ points: [[3.4, 6.5], [3.5, 6.6]], gapAfterIndex: [], cursorIndex: 0, cursorPosition: [3.4, 6.5], chevrons: true });
      adapter.setTheme("light", contractTokens);
      adapter.fitBounds({ south: 6, west: 3, north: 7, east: 4 });
      adapter.flyTo([3.5, 6.6], 12);
      expect(adapter.getViewport().zoom).toBe(12);
      adapter.destroy();
    });

    it("accepts camera padding when flying to a point", async () => {
      const adapter = options.create();
      await adapter.mount(document.createElement("div"), {
        theme: "light",
        tokens: contractTokens,
      });
      const padding = { top: 96, right: 444, bottom: 12, left: 12 };
      adapter.flyTo([3.5, 6.6], 12, { padding });
      expect(adapter.getViewport().zoom).toBe(12);
      adapter.destroy();
    });

    it("unsubscribes listeners and tolerates a second destroy", async () => {
      const adapter = options.create();
      const listener = vi.fn();
      const unsubscribe = adapter.on("mapClick", listener);
      unsubscribe();
      await adapter.mount(document.createElement("div"), {
        theme: "light",
        tokens: contractTokens,
      });
      adapter.destroy();
      adapter.destroy();
    });
  });
}

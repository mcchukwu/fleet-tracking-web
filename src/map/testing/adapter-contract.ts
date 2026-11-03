import { describe, expect, it, vi } from "vitest";
import type { MapAdapter, MapTokens } from "../types";

export const contractTokens: MapTokens = {
  colors: {
    surface: "surface-token",
    text: "text-token",
    textMuted: "muted-token",
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
  fonts: { ui: "ui-token", data: "data-token" },
  marker: { radius: 12, ringWidth: 2, labelZoom: 13, clusterZoom: 11 },
  geofence: { fillOpacity: 0.12, strokeWidth: 2, labelZoom: 12 },
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
      expect(Boolean(adapter.draw)).toBe(adapter.capabilities.drawing);
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
      adapter.setRoute({ points: [[3.4, 6.5], [3.5, 6.6]], gapAfterIndex: [], cursorIndex: 0, chevrons: true });
      adapter.setTheme("light", contractTokens);
      adapter.fitBounds({ south: 6, west: 3, north: 7, east: 4 });
      adapter.flyTo([3.5, 6.6], 12);
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

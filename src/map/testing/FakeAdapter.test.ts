import { describe, expect, it } from "vitest";
import { FakeAdapter } from "./FakeAdapter";
import { runAdapterContract } from "./adapter-contract";

runAdapterContract("FakeAdapter", { create: () => new FakeAdapter() });

describe("FakeAdapter determinism", () => {
  it("records the last state passed by a feature", async () => {
    const adapter = new FakeAdapter();
    await adapter.mount(document.createElement("div"), {
      theme: "light",
      tokens: {
        colors: {
          surface: "s",
          text: "t",
          textMuted: "m",
          accent: "a",
          moving: "mv",
          idle: "i",
          offline: "o",
          alert: "al",
          geofenceDepot: "d",
          geofenceCustomer: "c",
          geofenceRestricted: "r",
          geofenceOther: "x",
        },
        fonts: { ui: "ui", data: "data" },
        marker: { radius: 12, ringWidth: 2, labelZoom: 13, clusterZoom: 11 },
        geofence: { fillOpacity: 0.12, strokeWidth: 2, labelZoom: 12 },
      },
    });
    adapter.setVehicles([
      {
        key: "demo-imei-0001",
        position: [3.4, 6.5],
        headingDeg: null,
        status: "idle",
        label: "LSD-100-AA",
        selected: true,
        stale: false,
      },
    ]);
    expect(adapter.vehicles[0]?.key).toBe("demo-imei-0001");
    expect(adapter.vehicles[0]?.selected).toBe(true);
  });
});

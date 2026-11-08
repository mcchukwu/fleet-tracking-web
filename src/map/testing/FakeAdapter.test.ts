import { describe, expect, it } from "vitest";
import { FakeAdapter } from "./FakeAdapter";
import { contractTokens, runAdapterContract } from "./adapter-contract";

runAdapterContract("FakeAdapter", { create: () => new FakeAdapter() });

describe("FakeAdapter determinism", () => {
  it("records the last state passed by a feature", async () => {
    const adapter = new FakeAdapter();
    await adapter.mount(document.createElement("div"), {
      theme: "light",
      tokens: contractTokens,
    });
    adapter.setVehicles([
      {
        key: "demo-imei-0001",
        position: [3.4, 6.5],
        headingDeg: null,
        status: "idle",
        label: "LSD-100-AA",
        selected: true,
        hovered: false,
        stale: false,
      },
    ]);
    expect(adapter.vehicles[0]?.key).toBe("demo-imei-0001");
    expect(adapter.vehicles[0]?.selected).toBe(true);
  });

  it("emulates the clustering it advertises", async () => {
    const adapter = new FakeAdapter();
    await adapter.mount(document.createElement("div"), {
      theme: "light",
      tokens: contractTokens,
    });
    adapter.viewport = { ...adapter.getViewport(), zoom: 7 };
    adapter.setVehicles([
      {
        key: "demo-imei-0001",
        position: [3.4, 6.5],
        headingDeg: null,
        status: "moving",
        label: "LSD-100-AA",
        selected: false,
        hovered: false,
        stale: false,
      },
      {
        key: "demo-imei-0002",
        position: [3.401, 6.501],
        headingDeg: null,
        status: "alert",
        label: "LSD-101-AA",
        selected: false,
        hovered: false,
        stale: false,
      },
    ]);

    expect(adapter.clusters).toHaveLength(1);
    expect(adapter.clusters[0]?.count).toBe(2);
    expect(adapter.clusters[0]?.worstStatus).toBe("alert");

    adapter.flyTo([3.4, 6.5], 14, { padding: { top: 96, right: 444, bottom: 12, left: 12 } });
    expect(adapter.flyPadding).toEqual({ top: 96, right: 444, bottom: 12, left: 12 });
    expect(adapter.clusters).toEqual([]);
  });

  it("keeps the prepared route cursor for deterministic assertions", async () => {
    const adapter = new FakeAdapter();
    await adapter.mount(document.createElement("div"), {
      theme: "light",
      tokens: contractTokens,
    });
    adapter.setRoute({
      points: [
        [3.4, 6.5],
        [3.5, 6.6],
      ],
      gapAfterIndex: [0],
      cursorIndex: 1,
      cursorPosition: [3.45, 6.55],
      chevrons: true,
    });

    expect(adapter.route?.cursorPosition).toEqual([3.45, 6.55]);
    expect(adapter.route?.cursorIndex).toBe(1);
    expect(adapter.route?.gapAfterIndex).toEqual([0]);
  });
});

import { describe, expect, it } from "vitest";
import { FakeAdapter } from "./FakeAdapter";
import { contractTokens, runAdapterContract } from "./adapter-contract";
import type { DrawController, LngLat } from "../types";

type FakeDraw = DrawController & {
  testAddVertex(point: LngLat): void;
  testSetRing(ring: readonly LngLat[]): void;
};

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

describe("FakeAdapter drawing", () => {
  const ring: [number, number][] = [
    [3.4, 6.4],
    [3.5, 6.4],
    [3.5, 6.5],
  ];

  async function mountAdapter() {
    const element = document.createElement("div");
    const adapter = new FakeAdapter();
    await adapter.mount(element, { theme: "light", tokens: contractTokens });
    adapter.viewport = {
      center: [3.45, 6.45],
      zoom: 12,
      bearing: 0,
      bounds: { west: 3.3, south: 6.3, east: 3.6, north: 6.6 },
    };
    return { adapter, element, draw: adapter.draw as unknown as FakeDraw };
  }

  it("closes a polygon with Enter and reports it on change", async () => {
    const { adapter, element, draw } = await mountAdapter();
    const changes: unknown[] = [];
    draw.onChange((geometry) => changes.push(geometry));
    await draw.start("depot");

    for (const point of ring) draw.testAddVertex(point);
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(draw.getGeometry()?.coordinates).toEqual([[...ring, ring[0]]]);
    expect(changes[changes.length - 1]).toEqual({
      type: "Polygon",
      coordinates: [[...ring, ring[0]]],
    });
    adapter.destroy();
  });

  it("removes the last vertex with Backspace", async () => {
    const { adapter, element, draw } = await mountAdapter();
    await draw.start("depot");
    for (const point of ring) draw.testAddVertex(point);

    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(draw.getGeometry()).toBeNull();
    adapter.destroy();
  });

  it("cancels with Escape and emits null", async () => {
    const { adapter, element, draw } = await mountAdapter();
    const changes: unknown[] = [];
    draw.onChange((geometry) => changes.push(geometry));
    await draw.start("depot", ring);
    expect(draw.getGeometry()).not.toBeNull();

    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(draw.getGeometry()).toBeNull();
    expect(changes[changes.length - 1]).toBeNull();
    adapter.destroy();
  });

  it("seeds an edit session and replaces its ring through the test seam", async () => {
    const { adapter, draw } = await mountAdapter();
    await draw.start("customer", ring);
    expect(draw.getGeometry()?.coordinates).toEqual([[...ring, ring[0]]]);

    const moved = ring.map(([lon, lat]) => [lon + 0.001, lat] as [number, number]);
    draw.testSetRing(moved);
    expect(draw.getGeometry()?.coordinates).toEqual([[...moved, moved[0]]]);
    adapter.destroy();
  });

  it("ignores drawing keys typed in a field", async () => {
    const { adapter, element, draw } = await mountAdapter();
    const input = document.createElement("input");
    element.append(input);
    await draw.start("depot");
    for (const point of ring) draw.testAddVertex(point);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(draw.getGeometry()).toBeNull();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(draw.getGeometry()).toBeNull();
    adapter.destroy();
  });

  it("stops listening after destroy", async () => {
    const { adapter, element, draw } = await mountAdapter();
    await draw.start("depot");
    for (const point of ring) draw.testAddVertex(point);
    adapter.destroy();

    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(draw.getGeometry()).toBeNull();
  });
});

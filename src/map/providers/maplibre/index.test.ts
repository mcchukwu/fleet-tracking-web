import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contractTokens, runAdapterContract } from "../../testing/adapter-contract";
import type { MapVehicle } from "../../types";

const holder = vi.hoisted(() => {
  type Listener = (event: unknown) => void;

  class FakeSource {
    readonly id: string;
    readonly spec: Record<string, unknown>;
    data: unknown = null;
    constructor(id: string, spec: Record<string, unknown>) {
      this.id = id;
      this.spec = spec;
    }
    clusterOptions: Record<string, unknown> | null = null;
    async setData(data: unknown): Promise<void> {
      this.data = data;
    }
    async setClusterOptions(options: Record<string, unknown>): Promise<void> {
      this.clusterOptions = options;
    }
    getClusterExpansionZoom(): Promise<number> {
      return Promise.resolve(12);
    }
  }

  class FakeMap {
    readonly options: Record<string, unknown>;
    readonly sources = new Map<string, FakeSource>();
    readonly layers = new Map<string, Record<string, unknown>>();
    readonly styles: string[] = [];
    readonly controls: unknown[] = [];
    readonly canvas = document.createElement("canvas");
    readonly images = new Set<string>();
    features: unknown[] = [];
    zoom = 7;
    bearing = 0;
    removed = 0;
    easedTo: unknown[] | null = null;
    fitted: unknown[] | null = null;
    flown: unknown[] | null = null;
    private readonly listeners = new Map<string, Set<Listener>>();

    constructor(options: Record<string, unknown>) {
      this.options = options;
    }

    on(type: string, listener: Listener): this {
      const set = this.listeners.get(type) ?? new Set<Listener>();
      set.add(listener);
      this.listeners.set(type, set);
      return this;
    }

    once(type: string, listener: Listener): this {
      if (type === "style.load") queueMicrotask(() => listener({ type }));
      else this.on(type, listener);
      return this;
    }

    emit(type: string, event: unknown = {}): void {
      for (const listener of this.listeners.get(type) ?? []) listener(event);
    }

    addControl(control: unknown): this {
      this.controls.push(control);
      return this;
    }

    addSource(id: string, spec: Record<string, unknown>): this {
      this.sources.set(id, new FakeSource(id, spec));
      return this;
    }

    getSource(id: string): FakeSource | undefined {
      return this.sources.get(id);
    }

    addLayer(layer: Record<string, unknown>): this {
      this.layers.set(String(layer.id), layer);
      return this;
    }

    getLayer(id: string): Record<string, unknown> | undefined {
      return this.layers.get(id);
    }

    removeLayer(id: string): this {
      this.layers.delete(id);
      return this;
    }

    hasImage(id: string): boolean {
      return this.images.has(id);
    }

    addImage(id: string): this {
      this.images.add(id);
      return this;
    }

    removeImage(id: string): this {
      this.images.delete(id);
      return this;
    }

    setStyle(style: unknown): this {
      this.styles.push(style as string);
      this.sources.clear();
      this.layers.clear();
      return this;
    }

    getCanvas(): HTMLCanvasElement {
      return this.canvas;
    }

    getCenter(): { lng: number; lat: number } {
      return { lng: 3.4, lat: 6.5 };
    }

    getZoom(): number {
      return this.zoom;
    }

    zoomIn(): this {
      this.zoom += 1;
      return this;
    }

    zoomOut(): this {
      this.zoom -= 1;
      return this;
    }

    getBearing(): number {
      return this.bearing;
    }

    getBounds() {
      return {
        getSouth: () => 4,
        getWest: () => 2,
        getNorth: () => 8,
        getEast: () => 5,
      };
    }

    queryRenderedFeatures(): unknown[] {
      return this.features;
    }

    easeTo(options: unknown): this {
      this.easedTo = [options];
      const bearing = (options as { bearing?: number }).bearing;
      if (typeof bearing === "number") this.bearing = bearing;
      return this;
    }

    fitBounds(bounds: unknown, options: unknown): this {
      this.fitted = [bounds, options];
      return this;
    }

    flyTo(options: unknown): this {
      this.flown = [options];
      const zoom = (options as { zoom?: number }).zoom;
      if (typeof zoom === "number") this.zoom = zoom;
      return this;
    }

    remove(): void {
      this.removed += 1;
    }
  }

  return { FakeMap, map: null as FakeMap | null };
});

vi.mock("./sdk", () => ({
  createMap: (options: Record<string, unknown>) => {
    const map = new holder.FakeMap(options);
    holder.map = map;
    return map;
  },
}));

import { createMapLibreAdapter } from "./index";
import { LAYER_IDS, SOURCE_IDS } from "./layers";

function map(): InstanceType<typeof holder.FakeMap> {
  if (!holder.map) throw new Error("map was not created");
  return holder.map;
}

function reduceMotion(): void {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: query.includes("reduce") }) as unknown as MediaQueryList,
  );
}

const vehicle: MapVehicle = {
  key: "demo-imei-0001",
  position: [3.4, 6.5],
  headingDeg: 90,
  status: "moving",
  label: "LSD-100-AA",
  selected: false,
  hovered: false,
  stale: false,
};

beforeEach(() => {
  holder.map = null;
  reduceMotion();
  const context = {
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    lineWidth: 0,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    closePath: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    fillText: () => undefined,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => context,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

runAdapterContract("MapLibre", { create: () => createMapLibreAdapter() });

describe("MapLibre adapter", () => {
  it("declares honest capabilities for this slice", () => {
    const adapter = createMapLibreAdapter();
    expect(adapter.capabilities.offline).toBe(false);
    expect(adapter.capabilities.drawing).toBe(false);
    expect(adapter.capabilities.styles).toEqual(["standard"]);
    expect(adapter.draw).toBeUndefined();
  });

  it("does not install a native navigation control", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    expect(map().controls).toHaveLength(0);
    adapter.destroy();
  });

  it("mounts the satellite raster style when the env supplies one", async () => {
    const adapter = createMapLibreAdapter({
      styles: ["standard", "satellite"],
      satellite: {
        tilesUrl: "https://tiles.example.com/satellite/{z}/{x}/{y}.jpg",
        attribution: "© Example imagery",
        attributionHref: "https://example.com/licence",
      },
    });
    await adapter.mount(document.createElement("div"), {
      theme: "light",
      tokens: contractTokens,
      baseStyle: "satellite",
    });

    const style = map().options.style as {
      sources: Record<string, { type: string; tiles: string[]; attribution: string }>;
    };
    expect(style.sources["fleet-satellite"]?.type).toBe("raster");
    expect(style.sources["fleet-satellite"]?.attribution).toBe("© Example imagery");
    expect(style.sources["fleet-satellite"]?.tiles).toEqual([
      "https://tiles.example.com/satellite/{z}/{x}/{y}.jpg",
    ]);
    expect(map().layers.has(LAYER_IDS.vehicleHalo)).toBe(true);
    adapter.destroy();
  });

  it("switches the base style without dropping the data layers", async () => {
    const adapter = createMapLibreAdapter({
      styles: ["standard", "satellite"],
      satellite: {
        tilesUrl: "https://tiles.example.com/satellite/{z}/{x}/{y}.jpg",
        attribution: "© Example imagery",
      },
    });
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    const instance = map();
    expect(instance.layers.has(LAYER_IDS.vehicleHalo)).toBe(false);

    adapter.setBaseStyle("satellite");
    await vi.waitFor(() => expect(instance.layers.has(LAYER_IDS.vehicleCircle)).toBe(true));

    expect(instance.styles).toHaveLength(1);
    expect(instance.layers.has(LAYER_IDS.vehicleHalo)).toBe(true);
    expect(instance.sources.size).toBe(3);
    adapter.destroy();
  });

  it("ignores a base style this build does not offer", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    adapter.setBaseStyle("satellite");
    expect(map().styles).toHaveLength(0);
    adapter.destroy();
  });

  it("cancels a pending style wait when the adapter is destroyed", async () => {
    const adapter = createMapLibreAdapter({
      styles: ["standard", "satellite"],
      satellite: {
        tilesUrl: "https://tiles.example.com/satellite/{z}/{x}/{y}.jpg",
        attribution: "© Example imagery",
      },
    });
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    const instance = map();
    const once = vi.spyOn(instance, "once").mockImplementation(() => instance);

    vi.useFakeTimers();
    try {
      adapter.setBaseStyle("satellite");
      const switched = instance.styles.length;
      adapter.destroy();
      vi.advanceTimersByTime(4_000);
      expect(instance.styles).toHaveLength(switched);
    } finally {
      once.mockRestore();
      vi.useRealTimers();
    }
  });

  it("keeps the imagery while a theme change refreshes the data layers", async () => {
    const adapter = createMapLibreAdapter({
      styles: ["standard", "satellite"],
      satellite: {
        tilesUrl: "https://tiles.example.com/satellite/{z}/{x}/{y}.jpg",
        attribution: "© Example imagery",
      },
    });
    await adapter.mount(document.createElement("div"), {
      theme: "light",
      tokens: contractTokens,
      baseStyle: "satellite",
    });
    const instance = map();

    adapter.setTheme("dark", contractTokens);

    expect(instance.styles).toHaveLength(0);
    expect(instance.layers.has(LAYER_IDS.vehicleHalo)).toBe(true);
    const label = instance.layers.get(LAYER_IDS.vehicleLabel)?.paint as
      | Record<string, unknown>
      | undefined;
    expect(label?.["text-halo-width"]).toBe(2);
    adapter.destroy();
  });

  it("installs clustered vehicle, geofence and route layers from tokens", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });

    const instance = map();
    expect(instance.sources.get(SOURCE_IDS.vehicles)?.spec.cluster).toBe(true);
    expect(instance.layers.has(LAYER_IDS.vehicleCircle)).toBe(true);
    expect(instance.layers.has(LAYER_IDS.geofenceFill)).toBe(true);
    expect(instance.layers.has(LAYER_IDS.routeLine)).toBe(true);

    const paint = instance.layers.get(LAYER_IDS.vehicleCircle)?.paint as
      | Record<string, unknown>
      | undefined;
    expect(JSON.stringify(paint?.["circle-color"])).toContain("moving-token");
    adapter.destroy();
  });

  it("writes vehicle data once per update", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    const source = map().sources.get(SOURCE_IDS.vehicles);
    const setData = vi.spyOn(source!, "setData");

    adapter.setVehicles([vehicle]);
    expect(setData).toHaveBeenCalledTimes(1);

    adapter.setVehicles([]);
    expect(setData).toHaveBeenCalledTimes(2);
    adapter.destroy();
  });

  it("keeps an unchanged vehicle's glide running when another target changes", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    const source = map().sources.get(SOURCE_IDS.vehicles);
    if (!source) throw new Error("vehicle source is missing");

    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) => ({ matches: false, media: query }) as unknown as MediaQueryList,
    );
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    let active: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      active = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      active = null;
    });
    const runFrame = (at: number) => {
      now = at;
      const callback = active;
      active = null;
      callback?.(at);
    };
    const positionOf = (key: string): [number, number] | undefined => {
      const data = source.data as {
        features: Array<{ properties: { key: string }; geometry: { coordinates: [number, number] } }>;
      };
      return data.features.find((feature) => feature.properties.key === key)?.geometry.coordinates;
    };

    const a0 = { ...vehicle, key: "a", position: [3, 6] as [number, number] };
    const b0 = { ...vehicle, key: "b", position: [5, 8] as [number, number] };
    adapter.setVehicles([a0, b0]);

    now = 1_000;
    adapter.setVehicles([
      { ...a0, position: [3.1, 6] },
      { ...b0, position: [5.1, 8] },
    ]);
    runFrame(1_000);
    now = 1_500;
    runFrame(1_500);

    now = 1_600;
    adapter.setVehicles([
      { ...a0, position: [3.2, 6] },
      { ...b0, position: [5.1, 8] },
    ]);
    now = 2_000;
    runFrame(2_000);

    expect(positionOf("b")).toEqual([5.1, 8]);
    adapter.destroy();
  });


  it("swaps the style on a theme change without duplicating layers", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    const instance = map();

    adapter.setTheme("dark", contractTokens);
    await vi.waitFor(() => expect(instance.layers.has(LAYER_IDS.vehicleCircle)).toBe(true));

    expect(instance.styles).toHaveLength(1);
    expect(instance.styles[0]).toContain("dark");
    expect(instance.sources.size).toBe(3);
    adapter.destroy();
  });

  it("refreshes paints on an accent change without touching the style", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    const instance = map();

    adapter.setTheme("light", {
      ...contractTokens,
      colors: { ...contractTokens.colors, accent: "violet-token" },
    });

    expect(instance.styles).toHaveLength(0);
    const paint = instance.layers.get(LAYER_IDS.vehicleSelected)?.paint as
      | Record<string, unknown>
      | undefined;
    expect(JSON.stringify(paint?.["circle-stroke-color"])).toContain("violet-token");
    adapter.destroy();
  });

  it("emits vehicle clicks, hover positions and viewport changes", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    const instance = map();

    const clicked = vi.fn();
    const hovered = vi.fn();
    const viewport = vi.fn();
    adapter.on("vehicleClick", clicked);
    adapter.on("vehicleHover", hovered);
    adapter.on("viewportChange", viewport);

    instance.features = [{ properties: { key: "demo-imei-0001" }, geometry: { type: "Point", coordinates: [3, 6] } }];
    instance.emit("click", { point: { x: 10, y: 20 }, lngLat: { lng: 3, lat: 6 } });
    expect(clicked).toHaveBeenCalledWith({ key: "demo-imei-0001" });

    instance.emit("mousemove", { point: { x: 12, y: 24 }, lngLat: { lng: 3, lat: 6 } });
    expect(hovered).toHaveBeenCalledWith({ key: "demo-imei-0001", point: { x: 12, y: 24 } });

    instance.emit("moveend");
    expect(viewport).toHaveBeenCalled();

    adapter.destroy();
  });

  it("emits cluster clicks and zooms to the cluster expansion", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    const instance = map();
    const clicked = vi.fn();
    adapter.on("clusterClick", clicked);

    instance.features = [
      {
        properties: { cluster_id: 42, point_count: 7 },
        geometry: { type: "Point", coordinates: [3.2, 6.4] },
      },
    ];
    instance.emit("click", { point: { x: 10, y: 20 }, lngLat: { lng: 3, lat: 6 } });

    expect(clicked).toHaveBeenCalledWith({ clusterId: "42", count: 7 });
    await vi.waitFor(() =>
      expect(instance.easedTo).toEqual([{ center: [3.2, 6.4], zoom: 12.2 }]),
    );
    adapter.destroy();
  });

  it("reuses unchanged vehicle features between updates", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    const source = map().sources.get(SOURCE_IDS.vehicles);
    if (!source) throw new Error("vehicle source is missing");
    const unchanged: MapVehicle = { ...vehicle, key: "demo-imei-0002", position: [3.6, 6.7] };

    adapter.setVehicles([vehicle, unchanged]);
    const first = source.data as { features: unknown[] };
    adapter.setVehicles([{ ...vehicle, position: [3.5, 6.6] }, unchanged]);
    const second = source.data as { features: unknown[] };

    expect(second.features[1]).toBe(first.features[1]);
    expect(second.features[0]).not.toBe(first.features[0]);
    adapter.destroy();
  });

  it("clusters earlier once the fleet exceeds its comfort budget", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    const source = map().sources.get(SOURCE_IDS.vehicles);
    if (!source) throw new Error("vehicle source is missing");

    const crowded = Array.from({ length: 1_001 }, (_, index): MapVehicle => ({
      ...vehicle,
      key: `demo-imei-${String(index).padStart(4, "0")}`,
      position: [3.4 + index * 0.0001, 6.5],
    }));
    adapter.setVehicles(crowded);

    await vi.waitFor(() =>
      expect(source.clusterOptions?.clusterMaxZoom).toBe(
        contractTokens.marker.clusterMaxZoom + 2,
      ),
    );
    adapter.destroy();
  });

  it("keeps the alert glyph upright while the chevron follows the heading", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    const layout = map().layers.get(LAYER_IDS.vehicleGlyph)?.layout as
      | Record<string, unknown>
      | undefined;
    const rotation = JSON.stringify(layout?.["icon-rotate"]);

    expect(rotation).toContain('"alert"');
    expect(rotation).toContain('"heading"');
    adapter.destroy();
  });

  it("emits a map error when the renderer fails after mount", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    const onError = vi.fn();
    adapter.on("error", onError);

    map().emit("error", { error: new Error("renderer crashed") });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ kind: "map" });
    adapter.destroy();
  });

  it("emits a map error when the WebGL context is lost", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    const onError = vi.fn();
    adapter.on("error", onError);

    map().getCanvas().dispatchEvent(new Event("webglcontextlost", { cancelable: true }));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ kind: "map" });
    adapter.destroy();
  });

  it("rejects a second mount and tolerates a second destroy", async () => {
    const adapter = createMapLibreAdapter();
    await adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens });
    await expect(
      adapter.mount(document.createElement("div"), { theme: "light", tokens: contractTokens }),
    ).rejects.toThrow();

    adapter.destroy();
    adapter.destroy();
    expect(map().removed).toBe(1);
  });
});

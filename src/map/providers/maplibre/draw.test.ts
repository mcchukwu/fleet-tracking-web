import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contractTokens } from "../../testing/adapter-contract";
import { isTypingTarget, polygonFromSnapshot } from "./draw";

const holder = vi.hoisted(() => {
  class MockDraw {
    static latest: MockDraw | null = null;
    snapshot: { geometry: { type: string; coordinates?: unknown } }[] = [];
    started = 0;
    stopped = 0;
    cleared = 0;
    mode = "";
    selected: Array<string | number> = [];
    features: unknown[] = [];
    readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    constructor() {
      MockDraw.latest = this;
    }

    start(): void {
      this.started += 1;
    }
    stop(): void {
      this.stopped += 1;
    }
    clear(): void {
      this.cleared += 1;
      this.snapshot = [];
    }
    on(event: string, listener: (...args: unknown[]) => void): void {
      const set = this.listeners.get(event) ?? new Set();
      set.add(listener);
      this.listeners.set(event, set);
    }
    off(event: string, listener: (...args: unknown[]) => void): void {
      this.listeners.get(event)?.delete(listener);
    }
    emit(event: string): void {
      for (const listener of this.listeners.get(event) ?? []) listener();
    }
    setMode(mode: string): void {
      this.mode = mode;
    }
    getFeatureId(): string {
      return "draw-feature";
    }
    addFeatures(features: unknown[]): void {
      this.features = features;
      const feature = features[0] as
        { geometry?: { type: string; coordinates?: unknown } } | undefined;
      if (feature?.geometry) this.snapshot = [feature as never];
    }
    selectFeature(id: string | number): void {
      this.selected.push(id);
    }
    getSnapshot(): { geometry: { type: string; coordinates?: unknown } }[] {
      return this.snapshot;
    }
  }

  class MockPolygonMode {
    static latest: MockPolygonMode | null = null;
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown> = {}) {
      this.options = options;
      MockPolygonMode.latest = this;
    }
    updateOptions(options: Record<string, unknown>): void {
      this.options = { ...this.options, ...options };
    }
  }

  class MockSelectMode {
    static latest: MockSelectMode | null = null;
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown> = {}) {
      this.options = options;
      MockSelectMode.latest = this;
    }
    updateOptions(options: Record<string, unknown>): void {
      this.options = { ...this.options, ...options };
    }
  }

  class MockAdapter {
    constructor(_options: Record<string, unknown>) {}
  }

  return { MockDraw, MockPolygonMode, MockSelectMode, MockAdapter };
});

vi.mock("terra-draw", () => ({
  TerraDraw: holder.MockDraw,
  TerraDrawPolygonMode: holder.MockPolygonMode,
  TerraDrawSelectMode: holder.MockSelectMode,
}));

vi.mock("terra-draw-maplibre-gl-adapter", () => ({
  TerraDrawMapLibreGLAdapter: holder.MockAdapter,
}));

async function loadController() {
  const { createTerraDrawController } = await import("./draw");
  return createTerraDrawController({
    getMap: () => ({}) as never,
    getTokens: () => contractTokens,
  });
}

const ring: [number, number][] = [
  [3.4, 6.4],
  [3.5, 6.4],
  [3.5, 6.5],
];

beforeEach(() => {
  holder.MockDraw.latest = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("polygonFromSnapshot", () => {
  it("takes the last completed polygon and closes its ring", () => {
    expect(
      polygonFromSnapshot([
        { geometry: { type: "Point", coordinates: [3.4, 6.4] } },
        {
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [3.4, 6.4],
                [3.5, 6.4],
                [3.5, 6.5],
              ],
            ],
          },
        },
      ]),
    ).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [3.4, 6.4],
          [3.5, 6.4],
          [3.5, 6.5],
          [3.4, 6.4],
        ],
      ],
    });
  });

  it("rejects non-polygons and unusable rings", () => {
    expect(polygonFromSnapshot([])).toBeNull();
    expect(
      polygonFromSnapshot([{ geometry: { type: "Polygon", coordinates: [[[3.4, 6.4]]] } }]),
    ).toBeNull();
    expect(
      polygonFromSnapshot([{ geometry: { type: "LineString", coordinates: [[3.4, 6.4]] } }]),
    ).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("recognises fields and ignores other targets", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("Terra Draw controller", () => {
  it("starts a polygon session and seeds an edit ring", async () => {
    const controller = await loadController();
    await controller.start("depot");
    expect(holder.MockDraw.latest?.started).toBe(1);
    expect(holder.MockDraw.latest?.mode).toBe("polygon");
    expect(controller.getGeometry()).toBeNull();

    await controller.start("customer", ring);
    expect(holder.MockDraw.latest?.mode).toBe("select");
    expect(holder.MockDraw.latest?.selected).toEqual(["draw-feature"]);
    expect(controller.getGeometry()?.coordinates).toEqual([[...ring, ring[0]]]);
    controller.dispose();
  });

  it("emits live geometry on change and null on cancel", async () => {
    const controller = await loadController();
    const changes: unknown[] = [];
    controller.onChange((geometry) => changes.push(geometry));
    await controller.start("other");
    const draw = holder.MockDraw.latest;
    if (!draw) throw new Error("draw was not created");
    draw.snapshot = [{ geometry: { type: "Polygon", coordinates: [ring] } }];
    draw.emit("finish");
    expect(changes[changes.length - 1]).toEqual({
      type: "Polygon",
      coordinates: [[...ring, ring[0]]],
    });

    controller.cancel();
    expect(controller.getGeometry()).toBeNull();
    expect(changes[changes.length - 1]).toBeNull();
    controller.dispose();
  });

  it("refreshes mode styles with new tokens", async () => {
    const controller = await loadController();
    await controller.start("depot");
    controller.setTokens({
      ...contractTokens,
      colors: { ...contractTokens.colors, accent: "#ff0000" },
    });
    expect(holder.MockPolygonMode.latest?.options.styles).toMatchObject({
      fillColor: "#ff0000",
      fillOpacity: 0,
      outlineColor: "#ff0000",
      outlineOpacity: 0,
    });
    expect(holder.MockSelectMode.latest?.options.styles).toMatchObject({
      selectedPolygonOutlineColor: "#ff0000",
      selectedPolygonFillOpacity: 0,
      selectedPolygonOutlineWidth: 0,
    });
    controller.dispose();
  });

  it("leaves the unsaved polygon to the app overlay", async () => {
    const controller = await loadController();
    await controller.start("depot");
    expect(holder.MockPolygonMode.latest?.options.styles).toMatchObject({
      fillOpacity: 0,
      outlineOpacity: 0,
    });
    expect(holder.MockSelectMode.latest?.options.styles).toMatchObject({
      selectedPolygonFillOpacity: 0,
      selectedPolygonOutlineWidth: 0,
    });
    controller.dispose();
  });

  it("recovers from a failed start on the next attempt", async () => {
    const { createTerraDrawController } = await import("./draw");
    let maps = 0;
    const controller = createTerraDrawController({
      getMap: () => (maps++ === 0 ? null : ({} as never)),
      getTokens: () => contractTokens,
    });
    await expect(controller.start("depot")).rejects.toThrow("not ready");
    await controller.start("depot");
    expect(holder.MockDraw.latest?.mode).toBe("polygon");
    controller.dispose();
  });

  it("restarts a completed edit session after a style swap", async () => {
    const controller = await loadController();
    await controller.start("depot", ring);
    controller.restart();
    expect(holder.MockDraw.latest?.stopped).toBeGreaterThan(0);
    await vi.waitFor(() => expect(holder.MockDraw.latest?.mode).toBe("select"));
    controller.dispose();
  });

  it("removes the keyboard guard when disposed", async () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const controller = await loadController();
    await controller.start("depot");
    controller.dispose();
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function), true);
  });
});

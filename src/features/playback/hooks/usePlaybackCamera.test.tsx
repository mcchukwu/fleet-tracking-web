import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeAdapter } from "../../../map/testing/FakeAdapter";
import { contractTokens } from "../../../map/testing/adapter-contract";
import type { LngLat } from "../../../map/types";
import { usePlaybackCamera } from "./usePlaybackCamera";

const points: LngLat[] = [
  [3.4, 6.5],
  [3.5, 6.6],
  [3.6, 6.7],
];

async function adapter() {
  const instance = new FakeAdapter();
  await instance.mount(document.createElement("div"), {
    theme: "light",
    tokens: contractTokens,
  });
  return instance;
}

function renderCamera(instance: FakeAdapter, overrides: Record<string, unknown> = {}) {
  return renderHook(
    (props: Parameters<typeof usePlaybackCamera>[0]) => usePlaybackCamera(props),
    {
      initialProps: {
        adapter: instance,
        points,
        fitKey: "vehicle|range",
        topInset: 96,
        bottomInset: 180,
        reducedMotion: false,
        ...overrides,
      } as Parameters<typeof usePlaybackCamera>[0],
    },
  );
}

describe("usePlaybackCamera", () => {
  it("fits the route with measured insets", async () => {
    const instance = await adapter();
    renderCamera(instance);
    expect(instance.viewport.bounds).toEqual({
      south: 6.5,
      west: 3.4,
      north: 6.7,
      east: 3.6,
    });
  });

  it("flies to a single point", async () => {
    const instance = await adapter();
    renderCamera(instance, { points: [[3.4, 6.5]] });
    expect(instance.viewport.center).toEqual([3.4, 6.5]);
    expect(instance.viewport.zoom).toBe(14);
    expect(instance.flyPadding).toEqual({ top: 108, right: 12, bottom: 192, left: 12 });
  });

  it("fits again only when the fit key changes or Fit route is called", async () => {
    const instance = await adapter();
    const { result, rerender } = renderCamera(instance);
    instance.flyTo([0, 0], 5);
    rerender({
      adapter: instance,
      points,
      fitKey: "new-key",
      topInset: 96,
      bottomInset: 180,
      reducedMotion: false,
    });
    expect(instance.viewport.bounds).toEqual({ south: 6.5, west: 3.4, north: 6.7, east: 3.6 });

    instance.flyTo([0, 0], 5);
    result.current.fit();
    expect(instance.viewport.bounds).toEqual({ south: 6.5, west: 3.4, north: 6.7, east: 3.6 });

    instance.flyTo([0, 0], 5);
    rerender({
      adapter: instance,
      points,
      fitKey: "new-key",
      topInset: 120,
      bottomInset: 220,
      reducedMotion: false,
    });
    expect(instance.viewport.center).toEqual([0, 0]);
  });

  it("does nothing without points", async () => {
    const instance = await adapter();
    const before = instance.viewport;
    renderCamera(instance, { points: [] });
    expect(instance.viewport).toBe(before);
  });
});

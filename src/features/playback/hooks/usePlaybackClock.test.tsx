import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaybackClock } from "./usePlaybackClock";
import type { Point } from "../../../api/types";

const fromMs = Date.parse("2026-11-08T14:00:00Z");
const toMs = Date.parse("2026-11-08T14:10:00Z");
const points: Point[] = [
  { t: new Date(fromMs).toISOString(), lat: 6.5, lon: 3.4, speed_kph: 40, heading_deg: 90 },
  {
    t: new Date(fromMs + 30_000).toISOString(),
    lat: 6.6,
    lon: 3.5,
    speed_kph: 50,
    heading_deg: 95,
  },
];

let now = 0;
const callbacks = new Map<number, FrameRequestCallback>();
let nextId = 1;

function runFrame(at: number): void {
  now = at;
  const pending = [...callbacks.values()];
  callbacks.clear();
  act(() => {
    for (const callback of pending) callback(at);
  });
}

beforeEach(() => {
  now = 0;
  callbacks.clear();
  nextId = 1;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    callbacks.delete(id);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderClock(overrides: Partial<Parameters<typeof usePlaybackClock>[0]> = {}) {
  return renderHook((props: Parameters<typeof usePlaybackClock>[0]) => usePlaybackClock(props), {
    initialProps: {
      points,
      gapAfterIndex: [],
      fromMs,
      toMs,
      reducedMotion: false,
      resetKey: "vehicle|range",
      ...overrides,
    },
  });
}

describe("usePlaybackClock", () => {
  it("advances the playhead at the selected speed", () => {
    const { result } = renderClock();
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(true);

    runFrame(100);
    expect(result.current.playheadMs).toBe(fromMs + 100);

    act(() => result.current.setSpeed(4));
    runFrame(200);
    expect(result.current.playheadMs).toBe(fromMs + 100 + 400);
  });

  it("pauses at the end and restarts from the beginning", () => {
    const { result } = renderClock({ fromMs: toMs - 200, toMs });
    act(() => result.current.toggle());
    runFrame(250);
    expect(result.current.playheadMs).toBe(toMs);
    expect(result.current.playing).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.playheadMs).toBe(toMs - 200);
    expect(result.current.playing).toBe(true);
  });

  it("steps and seeks, always pausing", () => {
    const { result } = renderClock();
    act(() => result.current.toggle());
    act(() => result.current.step(1));
    expect(result.current.playheadMs).toBe(fromMs + 30_000);
    expect(result.current.playing).toBe(false);

    act(() => result.current.seek(fromMs + 10_000));
    expect(result.current.playheadMs).toBe(fromMs + 10_000);
    expect(result.current.playing).toBe(false);
  });

  it("pauses when the document is hidden", () => {
    const { result } = renderClock();
    act(() => result.current.toggle());
    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.playing).toBe(false);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("resets to the range start when the range changes", () => {
    const { result, rerender } = renderClock();
    act(() => result.current.seek(fromMs + 60_000));
    rerender({
      points,
      gapAfterIndex: [],
      fromMs: toMs,
      toMs: toMs + 60_000,
      reducedMotion: false,
      resetKey: "vehicle|new-range",
    });
    expect(result.current.playheadMs).toBe(toMs);
    expect(result.current.playing).toBe(false);
  });

  it("exposes the interpolated cursor", () => {
    const { result } = renderClock();
    act(() => result.current.seek(fromMs + 15_000));
    expect(result.current.cursor.position?.[0]).toBeCloseTo(3.45, 6);
  });
});

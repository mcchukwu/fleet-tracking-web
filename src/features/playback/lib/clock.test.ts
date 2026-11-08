import { describe, expect, it } from "vitest";
import { clockReducer, createClock, nextSpeed, stepTime } from "./clock";
import { PLAYBACK_SPEEDS } from "./constants";

const fromMs = 1_000_000;
const toMs = fromMs + 60_000;

function state(overrides: Partial<ReturnType<typeof createClock>> = {}) {
  return { ...createClock(fromMs, toMs), ...overrides };
}

describe("clockReducer", () => {
  it("advances by wall time times the selected speed", () => {
    const at1x = clockReducer(state({ playing: true, speed: 1 }), {
      type: "advance",
      deltaMs: 1_000,
      fromMs,
      toMs,
    });
    expect(at1x.playheadMs).toBe(fromMs + 1_000);

    const at16x = clockReducer(state({ playing: true, speed: 16 }), {
      type: "advance",
      deltaMs: 1_000,
      fromMs,
      toMs,
    });
    expect(at16x.playheadMs).toBe(fromMs + 16_000);
  });

  it("clamps at the end and stops playing", () => {
    const next = clockReducer(state({ playing: true, speed: 16 }), {
      type: "advance",
      deltaMs: 10_000,
      fromMs,
      toMs,
    });
    expect(next.playheadMs).toBe(toMs);
    expect(next.playing).toBe(false);
  });

  it("restarts from the beginning when play is pressed at the end", () => {
    const next = clockReducer(state({ playheadMs: toMs }), {
      type: "play",
      fromMs,
      toMs,
    });
    expect(next.playheadMs).toBe(fromMs);
    expect(next.playing).toBe(true);
  });

  it("toggles and pauses", () => {
    const playing = clockReducer(state(), { type: "toggle", fromMs, toMs });
    expect(playing.playing).toBe(true);
    expect(clockReducer(playing, { type: "toggle", fromMs, toMs }).playing).toBe(false);
  });

  it("pauses when seeking", () => {
    const next = clockReducer(state({ playing: true }), {
      type: "seek",
      timeMs: fromMs + 30_000,
      fromMs,
      toMs,
    });
    expect(next).toMatchObject({ playing: false, playheadMs: fromMs + 30_000 });
  });

  it("steps to the next and previous point and pauses", () => {
    const points = [{ t: new Date(fromMs).toISOString() }, { t: new Date(fromMs + 30_000).toISOString() }, { t: new Date(toMs).toISOString() }];
    const forward = clockReducer(state({ playing: true, playheadMs: fromMs }), {
      type: "step",
      direction: 1,
      points,
      fromMs,
      toMs,
    });
    expect(forward.playheadMs).toBe(fromMs + 30_000);
    expect(forward.playing).toBe(false);

    const back = clockReducer(forward, {
      type: "step",
      direction: -1,
      points,
      fromMs,
      toMs,
    });
    expect(back.playheadMs).toBe(fromMs);
  });

  it("resets to the new range start and stops", () => {
    const next = clockReducer(state({ playing: true, playheadMs: toMs }), {
      type: "reset",
      fromMs: toMs,
      toMs: toMs + 60_000,
    });
    expect(next).toMatchObject({ playheadMs: toMs, playing: false });
  });

  it("changes speed within the allowed steps", () => {
    expect(
      clockReducer(state({ speed: 1 }), { type: "speed", direction: -1 }).speed,
    ).toBe(1);
    expect(
      clockReducer(state({ speed: 16 }), { type: "speed", direction: 1 }).speed,
    ).toBe(16);
    expect(
      clockReducer(state({ speed: 2 }), { type: "speed", direction: 1 }).speed,
    ).toBe(4);
  });
});

describe("helpers", () => {
  it("steps through the speed ladder", () => {
    expect(PLAYBACK_SPEEDS).toEqual([1, 2, 4, 8, 16]);
    expect(nextSpeed(1, 1)).toBe(2);
    expect(nextSpeed(16, 1)).toBe(16);
    expect(nextSpeed(1, -1)).toBe(1);
  });

  it("steps to point times with clamping", () => {
    const points = [{ t: new Date(fromMs + 10_000).toISOString() }, { t: new Date(fromMs + 20_000).toISOString() }];
    expect(stepTime(points, fromMs, 1)).toBe(fromMs + 10_000);
    expect(stepTime(points, fromMs + 15_000, 1)).toBe(fromMs + 20_000);
    expect(stepTime(points, fromMs + 15_000, -1)).toBe(fromMs + 10_000);
    expect(stepTime(points, fromMs + 10_000, -1)).toBe(fromMs + 10_000);
  });
});

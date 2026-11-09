import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { Point } from "../../../api/types";
import { cursorAt, findGaps, type Cursor } from "../lib/history";
import { clockReducer, createClock } from "../lib/clock";
import { CLOCK_COMMIT_MS, MAX_FRAME_DELTA_MS } from "../lib/constants";

export interface PlaybackClockOptions {
  points: readonly Point[];
  gapAfterIndex: readonly number[];
  fromMs: number;
  toMs: number;
  reducedMotion: boolean;
  resetKey: string;
  enabled?: boolean;
}

export interface PlaybackClockController {
  playheadMs: number;
  playing: boolean;
  speed: number;
  cursor: Cursor;
  toggle: () => void;
  pause: () => void;
  step: (direction: -1 | 1) => void;
  seek: (timeMs: number) => void;
  changeSpeed: (direction: -1 | 1) => void;
  setSpeed: (speed: number) => void;
  fitKey: string;
}

export function usePlaybackClock({
  points,
  gapAfterIndex,
  fromMs,
  toMs,
  reducedMotion,
  resetKey,
  enabled = true,
}: PlaybackClockOptions): PlaybackClockController {
  const [state, dispatch] = useReducer(clockReducer, undefined, () =>
    createClock(fromMs, toMs),
  );
  const pointsRef = useRef(points);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- a range or vehicle change must reset the clock to the new start.
    dispatch({ type: "reset", fromMs, toMs });
  }, [fromMs, toMs, resetKey]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) dispatch({ type: "pause" });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!state.playing || !enabled) return;
    if (typeof requestAnimationFrame !== "function") return;

    let frame = 0;
    let last = performance.now();
    let committedAt = last;
    let pending = 0;

    const tick = (now: number) => {
      const delta = Math.min(now - last, MAX_FRAME_DELTA_MS);
      last = now;
      pending += delta;
      if (now - committedAt >= CLOCK_COMMIT_MS) {
        dispatch({ type: "advance", deltaMs: pending, fromMs, toMs });
        pending = 0;
        committedAt = now;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.playing, enabled, fromMs, toMs]);

  const toggle = useCallback(() => dispatch({ type: "toggle", fromMs, toMs }), [fromMs, toMs]);
  const pause = useCallback(() => dispatch({ type: "pause" }), []);
  const step = useCallback(
    (direction: -1 | 1) =>
      dispatch({ type: "step", direction, points: pointsRef.current, fromMs, toMs }),
    [fromMs, toMs],
  );
  const seek = useCallback(
    (timeMs: number) => dispatch({ type: "seek", timeMs, fromMs, toMs }),
    [fromMs, toMs],
  );
  const changeSpeed = useCallback(
    (direction: -1 | 1) => dispatch({ type: "speed", direction }),
    [],
  );
  const setSpeed = useCallback((speed: number) => {
    dispatch({ type: "set-speed", speed });
  }, []);

  const cursor = useMemo(
    () => cursorAt(points, state.playheadMs, gapAfterIndex, reducedMotion),
    [points, state.playheadMs, gapAfterIndex, reducedMotion],
  );

  const computedGaps = useMemo(() => findGaps(points).gapAfterIndex, [points]);

  return {
    playheadMs: state.playheadMs,
    playing: state.playing,
    speed: state.speed,
    cursor,
    toggle,
    pause,
    step,
    seek,
    changeSpeed,
    setSpeed,
    fitKey: `${resetKey}|${fromMs}|${toMs}|${points.length}|${computedGaps.length}`,
  };
}

import { DEFAULT_SPEED, PLAYBACK_SPEEDS } from "./constants";

export interface ClockState {
  playheadMs: number;
  playing: boolean;
  speed: number;
}

export type ClockAction =
  | { type: "play"; fromMs: number; toMs: number }
  | { type: "pause" }
  | { type: "toggle"; fromMs: number; toMs: number }
  | { type: "advance"; deltaMs: number; fromMs: number; toMs: number }
  | { type: "seek"; timeMs: number; fromMs: number; toMs: number }
  | {
      type: "step";
      direction: -1 | 1;
      points: readonly { t: string }[];
      fromMs: number;
      toMs: number;
    }
  | { type: "speed"; direction: -1 | 1 }
  | { type: "set-speed"; speed: number }
  | { type: "reset"; fromMs: number; toMs: number };

export function createClock(fromMs: number, _toMs: number): ClockState {
  return { playheadMs: fromMs, playing: false, speed: DEFAULT_SPEED };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function nextSpeed(speed: number, direction: -1 | 1): number {
  const index = PLAYBACK_SPEEDS.findIndex((option) => option >= speed);
  const current = index === -1 ? PLAYBACK_SPEEDS.length - 1 : index;
  return PLAYBACK_SPEEDS[clamp(current + direction, 0, PLAYBACK_SPEEDS.length - 1)] ??
    PLAYBACK_SPEEDS[0];
}

export function stepTime(
  points: readonly { t: string }[],
  playheadMs: number,
  direction: -1 | 1,
): number {
  const times = points
    .map((point) => Date.parse(point.t))
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => a - b);
  if (times.length === 0) return playheadMs;
  if (direction === 1) {
    return times.find((time) => time > playheadMs) ?? times[times.length - 1] ?? playheadMs;
  }
  const previous = [...times].reverse().find((time) => time < playheadMs);
  return previous ?? times[0] ?? playheadMs;
}

function play(state: ClockState, fromMs: number, toMs: number): ClockState {
  const playheadMs = state.playheadMs >= toMs ? fromMs : state.playheadMs;
  return { ...state, playheadMs, playing: true };
}

export function clockReducer(state: ClockState, action: ClockAction): ClockState {
  switch (action.type) {
    case "play":
      return play(state, action.fromMs, action.toMs);
    case "pause":
      return { ...state, playing: false };
    case "toggle":
      return state.playing ? { ...state, playing: false } : play(state, action.fromMs, action.toMs);
    case "advance": {
      if (!state.playing) return state;
      const next = clamp(
        state.playheadMs + action.deltaMs * state.speed,
        action.fromMs,
        action.toMs,
      );
      return { ...state, playheadMs: next, playing: next < action.toMs };
    }
    case "seek":
      return {
        ...state,
        playheadMs: clamp(action.timeMs, action.fromMs, action.toMs),
        playing: false,
      };
    case "step":
      return {
        ...state,
        playheadMs: clamp(
          stepTime(action.points, state.playheadMs, action.direction),
          action.fromMs,
          action.toMs,
        ),
        playing: false,
      };
    case "speed":
      return { ...state, speed: nextSpeed(state.speed, action.direction) };
    case "set-speed": {
      const allowed = PLAYBACK_SPEEDS.includes(
        action.speed as (typeof PLAYBACK_SPEEDS)[number],
      );
      return allowed ? { ...state, speed: action.speed } : state;
    }
    case "reset":
      return { ...state, playheadMs: action.fromMs, playing: false };
  }
}

import { useCallback, useSyncExternalStore } from "react";

let clockNow = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function update(): void {
  clockNow = Date.now();
  for (const listener of listeners) listener();
}

function subscribeToClock(listener: () => void): () => void {
  if (listeners.size === 0) {
    clockNow = Date.now();
    timer = setInterval(update, 1_000);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function snapshot(): number {
  return clockNow;
}

export function useClock(enabled: boolean): number {
  const subscribe = useCallback(
    (listener: () => void) => (enabled ? subscribeToClock(listener) : () => undefined),
    [enabled],
  );
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

import { useSyncExternalStore } from "react";

export const TICKER_INTERVAL_MS = 30_000;

type Listener = () => void;

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;
let current = Date.now();

function start(): void {
  if (timer !== null) return;
  current = Date.now();
  timer = setInterval(() => {
    current = Date.now();
    for (const listener of listeners) listener();
  }, TICKER_INTERVAL_MS);
}

function stop(): void {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
}

export function subscribeTicker(listener: Listener): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

export function tickerNow(): number {
  return current;
}

export function useNow(): number {
  return useSyncExternalStore(subscribeTicker, tickerNow, tickerNow);
}

export function resetTicker(): void {
  listeners.clear();
  stop();
  current = Date.now();
}

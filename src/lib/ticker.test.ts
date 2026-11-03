import { afterEach, describe, expect, it, vi } from "vitest";
import { resetTicker, subscribeTicker, tickerNow } from "./ticker";

afterEach(() => {
  resetTicker();
  vi.useRealTimers();
});

describe("shared ticker", () => {
  it("notifies every subscriber on one interval", () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeTicker(first);
    const unsubscribeSecond = subscribeTicker(second);

    vi.advanceTimersByTime(30_000);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    unsubscribeSecond();
  });

  it("stops when the last subscriber leaves", () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const unsubscribe = subscribeTicker(listener);
    unsubscribe();
    vi.advanceTimersByTime(90_000);
    expect(listener).not.toHaveBeenCalled();
  });

  it("updates the shared now value", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
    const unsubscribe = subscribeTicker(vi.fn());
    expect(tickerNow()).toBe(Date.parse("2026-11-03T12:00:00Z"));
    vi.advanceTimersByTime(30_000);
    expect(tickerNow()).toBe(Date.parse("2026-11-03T12:00:30Z"));
    unsubscribe();
  });
});

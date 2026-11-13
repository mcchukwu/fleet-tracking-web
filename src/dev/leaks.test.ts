import { afterEach, describe, expect, it } from "vitest";
import { installLeakCounters, readLeakCounts, resetLeakCounters } from "./leaks";

let uninstall: (() => void) | null = null;

afterEach(() => {
  uninstall?.();
  uninstall = null;
  resetLeakCounters();
});

describe("leak counters", () => {
  it("counts a listener only while it is attached", () => {
    uninstall = installLeakCounters();
    const handler = () => undefined;
    const before = readLeakCounts().listeners;
    window.addEventListener("fleet-test", handler);
    expect(readLeakCounts().listeners).toBe(before + 1);
    window.removeEventListener("fleet-test", handler);
    expect(readLeakCounts().listeners).toBe(before);
  });

  it("counts a timer only until it is cleared", () => {
    uninstall = installLeakCounters();
    const timeout = window.setTimeout(() => undefined, 60_000);
    expect(readLeakCounts().timers).toBe(1);
    window.clearTimeout(timeout);
    expect(readLeakCounts().timers).toBe(0);
  });

  it("restores the original primitives on uninstall", () => {
    const original = window.setTimeout;
    const stop = installLeakCounters();
    expect(window.setTimeout).not.toBe(original);
    stop();
    expect(window.setTimeout).toBe(original);
  });
});

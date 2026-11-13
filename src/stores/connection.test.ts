import { onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConnectivity, resetConnection, useConnectionStore } from "./connection";

const connectivityListeners: Array<() => void> = [];

beforeEach(() => {
  useConnectionStore.setState({ network: "online" });
  resetConnection();
  onlineManager.setOnline(true);
});

afterEach(() => {
  for (const stop of connectivityListeners.splice(0)) stop();
  vi.useRealTimers();
});

function startWithProbe(probe: () => Promise<boolean>, interval = 1_000) {
  const controller = createConnectivity({ probe, probeIntervalMs: interval });
  connectivityListeners.push(controller.start());
  return controller;
}

describe("connectivity truth", () => {
  it("starts online when the probe succeeds", async () => {
    const probe = vi.fn().mockResolvedValue(true);
    startWithProbe(probe);

    await vi.waitFor(() => expect(probe).toHaveBeenCalled());
    expect(useConnectionStore.getState().network).toBe("online");
  });

  it("goes offline when the browser goes offline", async () => {
    startWithProbe(vi.fn().mockResolvedValue(true));
    await vi.waitFor(() => expect(useConnectionStore.getState().network).toBe("online"));

    window.dispatchEvent(new Event("offline"));
    expect(useConnectionStore.getState().network).toBe("offline");
  });

  it("keeps a lying navigator.onLine offline until a probe succeeds", async () => {
    vi.useFakeTimers();
    const probe = vi.fn().mockResolvedValue(false);
    startWithProbe(probe, 1_000);

    await vi.advanceTimersByTimeAsync(0);
    expect(window.navigator.onLine).toBe(true);
    expect(useConnectionStore.getState().network).toBe("offline");

    probe.mockResolvedValue(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(useConnectionStore.getState().network).toBe("online");
  });

  it("probes on the browser online event without trusting it", async () => {
    vi.useFakeTimers();
    const probe = vi.fn().mockResolvedValue(false);
    startWithProbe(probe, 1_000);
    await vi.advanceTimersByTimeAsync(0);

    window.dispatchEvent(new Event("offline"));
    expect(useConnectionStore.getState().network).toBe("offline");

    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(useConnectionStore.getState().network).toBe("offline");

    probe.mockResolvedValue(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(useConnectionStore.getState().network).toBe("online");
  });

  it("starts the probe loop after a failed fetch and stops it on recovery", async () => {
    vi.useFakeTimers();
    const probe = vi.fn().mockResolvedValue(false);
    const controller = startWithProbe(probe, 1_000);
    await vi.advanceTimersByTimeAsync(0);

    controller.reportUnreachable();
    expect(useConnectionStore.getState().network).toBe("offline");

    const before = probe.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(probe.mock.calls.length).toBeGreaterThan(before);

    probe.mockResolvedValue(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(useConnectionStore.getState().network).toBe("online");

    const settled = probe.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(probe.mock.calls.length).toBe(settled);
  });

  it("treats any HTTP response as reachable", async () => {
    vi.useFakeTimers();
    const controller = startWithProbe(vi.fn().mockResolvedValue(false), 1_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(useConnectionStore.getState().network).toBe("offline");

    controller.reportReachable();
    expect(useConnectionStore.getState().network).toBe("online");
  });

  it("keeps TanStack Query's online manager in sync and announces transitions", async () => {
    vi.useFakeTimers();
    const events: boolean[] = [];
    const listener = (event: Event) => {
      events.push((event as CustomEvent<{ online: boolean }>).detail.online);
    };
    window.addEventListener("fleet:connectivity", listener);

    const controller = startWithProbe(vi.fn().mockResolvedValue(false), 1_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(onlineManager.isOnline()).toBe(false);

    controller.reportReachable();
    expect(onlineManager.isOnline()).toBe(true);
    expect(events).toEqual([false, true]);

    window.removeEventListener("fleet:connectivity", listener);
  });

  it("keeps the probe-backed state instead of re-reading navigator.onLine on reset", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get");
    useConnectionStore.setState({ network: "offline" });
    onLine.mockReturnValue(true);
    resetConnection();
    expect(useConnectionStore.getState().network).toBe("offline");
    expect(onlineManager.isOnline()).toBe(false);

    useConnectionStore.setState({ network: "online" });
    onLine.mockReturnValue(false);
    resetConnection();
    expect(useConnectionStore.getState().network).toBe("online");
    expect(onlineManager.isOnline()).toBe(true);
    onLine.mockRestore();
  });

  it("stops listening and probing after cleanup", async () => {
    vi.useFakeTimers();
    const probe = vi.fn().mockResolvedValue(false);
    const controller = createConnectivity({ probe, probeIntervalMs: 1_000 });
    const stop = controller.start();
    await vi.advanceTimersByTimeAsync(0);
    stop();

    const calls = probe.mock.calls.length;
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(probe.mock.calls.length).toBe(calls);
  });
});

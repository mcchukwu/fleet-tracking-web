import { describe, expect, it, vi } from "vitest";
import { createFrameBatcher } from "./batcher";

interface Frame {
  key: string;
  n: number;
}

function manualScheduler() {
  const callbacks: Array<() => void> = [];
  return {
    callbacks,
    schedule: (callback: () => void) => {
      callbacks.push(callback);
      return callbacks.length;
    },
    cancel: () => undefined,
  };
}

describe("frame batcher", () => {
  it("coalesces 500 pushes into one callback per scheduled frame", () => {
    const scheduler = manualScheduler();
    const onBatch = vi.fn();
    const batcher = createFrameBatcher<Frame>(onBatch, {
      schedule: scheduler.schedule,
      cancel: scheduler.cancel,
    });

    for (let n = 0; n < 500; n += 1) batcher.push({ key: `v-${n}`, n });
    expect(scheduler.callbacks).toHaveLength(1);
    expect(onBatch).not.toHaveBeenCalled();

    scheduler.callbacks[0]?.();
    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(onBatch.mock.calls[0]?.[0]).toHaveLength(500);
  });

  it("keeps only the newest frame per key", () => {
    const scheduler = manualScheduler();
    const onBatch = vi.fn();
    const batcher = createFrameBatcher<Frame>(onBatch, {
      keyOf: (frame) => frame.key,
      schedule: scheduler.schedule,
      cancel: scheduler.cancel,
    });

    batcher.push({ key: "a", n: 1 });
    batcher.push({ key: "b", n: 2 });
    batcher.push({ key: "a", n: 3 });
    scheduler.callbacks[0]?.();

    expect(onBatch.mock.calls[0]?.[0]).toEqual([
      { key: "a", n: 3 },
      { key: "b", n: 2 },
    ]);
  });

  it("bounds the queue by dropping the oldest distinct key", () => {
    const scheduler = manualScheduler();
    const onBatch = vi.fn();
    const batcher = createFrameBatcher<Frame>(onBatch, {
      max: 2,
      keyOf: (frame) => frame.key,
      schedule: scheduler.schedule,
      cancel: scheduler.cancel,
    });

    batcher.push({ key: "a", n: 1 });
    batcher.push({ key: "b", n: 2 });
    batcher.push({ key: "c", n: 3 });
    scheduler.callbacks[0]?.();

    expect(onBatch.mock.calls[0]?.[0]).toEqual([
      { key: "b", n: 2 },
      { key: "c", n: 3 },
    ]);
  });

  it("flushes pending frames when stopped", () => {
    const scheduler = manualScheduler();
    const onBatch = vi.fn();
    const batcher = createFrameBatcher<Frame>(onBatch, {
      schedule: scheduler.schedule,
      cancel: scheduler.cancel,
    });

    batcher.push({ key: "a", n: 1 });
    batcher.stop();
    expect(onBatch).toHaveBeenCalledTimes(1);

    batcher.push({ key: "b", n: 2 });
    expect(onBatch).toHaveBeenCalledTimes(1);
  });
});

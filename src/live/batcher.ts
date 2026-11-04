export interface FrameBatcherOptions<T> {
  max?: number;
  keyOf?: (item: T) => string;
  schedule?: (callback: () => void) => number;
  cancel?: (handle: number) => void;
}

export interface FrameBatcher<T> {
  push: (item: T) => void;
  flush: () => void;
  stop: () => void;
  size: () => number;
}

const DEFAULT_MAX = 5_000;

function defaultSchedule(callback: () => void): number {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
  return window.setTimeout(callback, 16);
}

function defaultCancel(handle: number): void {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(handle);
  else window.clearTimeout(handle);
}

/**
 * Coalesces incoming frames into one callback per animation frame. A repeated key
 * keeps only its newest frame, so a burst of positions costs one item per vehicle.
 */
export function createFrameBatcher<T>(
  onBatch: (items: T[]) => void,
  options: FrameBatcherOptions<T> = {},
): FrameBatcher<T> {
  const max = options.max ?? DEFAULT_MAX;
  const keyOf = options.keyOf;
  const schedule = options.schedule ?? defaultSchedule;
  const cancel = options.cancel ?? defaultCancel;

  let queue: T[] = [];
  let index = new Map<string, number>();
  let handle: number | null = null;
  let stopped = false;

  function reindex(): void {
    if (!keyOf) return;
    index = new Map();
    queue.forEach((item, position) => index.set(keyOf(item), position));
  }

  function flush(): void {
    if (handle !== null) {
      cancel(handle);
      handle = null;
    }
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    index = new Map();
    onBatch(batch);
  }

  function scheduleFlush(): void {
    if (handle !== null || stopped) return;
    handle = schedule(() => {
      handle = null;
      flush();
    });
  }

  return {
    push(item) {
      if (stopped) return;
      const key = keyOf?.(item);

      if (key !== undefined) {
        const position = index.get(key);
        if (position !== undefined) {
          queue[position] = item;
          scheduleFlush();
          return;
        }
      }

      if (queue.length >= max) {
        queue.shift();
        reindex();
      }

      if (key !== undefined) index.set(key, queue.length);
      queue.push(item);
      scheduleFlush();
    },
    flush,
    stop() {
      stopped = true;
      flush();
    },
    size() {
      return queue.length;
    },
  };
}

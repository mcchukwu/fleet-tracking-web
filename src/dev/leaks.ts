/**
 * Dev-only leak counters. Installed by the debug hook and removed on uninstall.
 * They wrap the browser primitives that a screen can forget to release:
 * event listeners, timers and WebSockets.
 */

export interface LeakCounts {
  listeners: number;
  timers: number;
  sockets: number;
  byType: Record<string, number>;
}

const timerIds = new Set<number>();
const listenerKeys = new Map<EventTarget, Map<string, Set<EventListenerOrEventListenerObject>>>();
const openSockets = new Set<WebSocket>();

let installed = false;
let restore: (() => void) | null = null;

function isLongLivedTarget(target: EventTarget): boolean {
  if (typeof Window !== "undefined" && target instanceof Window) return true;
  if (typeof Document !== "undefined" && target instanceof Document) return true;
  if (typeof AbortSignal !== "undefined" && target instanceof AbortSignal) return true;
  if (typeof MediaQueryList !== "undefined" && target instanceof MediaQueryList) return true;
  return false;
}

function addListener(
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject | null,
): void {
  if (!listener) return;
  // Only long-lived targets can leak across screens. Element and socket
  // listeners die with their target; tracking them retains detached nodes.
  if (!isLongLivedTarget(target)) return;
  // The mock WebSocket client relays its protocol through window events.
  if (type === "incoming" || type === "outgoing") return;
  let types = listenerKeys.get(target);
  if (!types) {
    types = new Map();
    listenerKeys.set(target, types);
  }
  let listeners = types.get(type);
  if (!listeners) {
    listeners = new Set();
    types.set(type, listeners);
  }
  listeners.add(listener);
}

function removeListener(
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject | null,
): void {
  if (!listener) return;
  const types = listenerKeys.get(target);
  types?.get(type)?.delete(listener);
  if (types && [...types.values()].every((set) => set.size === 0)) {
    listenerKeys.delete(target);
  }
}

export function installLeakCounters(): () => void {
  if (installed || typeof window === "undefined") return () => undefined;
  installed = true;

  // oxlint-disable-next-line typescript/unbound-method -- stored to restore the prototype.
  const originalAdd = EventTarget.prototype.addEventListener;
  // oxlint-disable-next-line typescript/unbound-method -- stored to restore the prototype.
  const originalRemove = EventTarget.prototype.removeEventListener;
  const windowAdd = window.addEventListener.bind(window);
  const windowRemove = window.removeEventListener.bind(window);
  const originalSetTimeout = window.setTimeout;
  const originalClearTimeout = window.clearTimeout;
  const originalSetInterval = window.setInterval;
  const originalClearInterval = window.clearInterval;
  const OriginalWebSocket = window.WebSocket;

  EventTarget.prototype.addEventListener = function trackedAdd(
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    addListener(this, type, listener);
    originalAdd.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function trackedRemove(
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    removeListener(this, type, listener);
    originalRemove.call(this, type, listener, options);
  };

  const trackedWindowAdd = function (
    this: Window,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    addListener(this, type, listener);
    (
      windowAdd as (
        this: Window,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) => void
    ).call(this, type, listener, options);
  };
  const trackedWindowRemove = function (
    this: Window,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    removeListener(this, type, listener);
    (
      windowRemove as (
        this: Window,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions,
      ) => void
    ).call(this, type, listener, options);
  };
  window.addEventListener = trackedWindowAdd;
  window.removeEventListener = trackedWindowRemove;

  const trackTimeout = (handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
    const id = (originalSetTimeout as (...values: unknown[]) => number)(handler, timeout, ...args);
    timerIds.add(id);
    return id;
  };
  const trackInterval = (handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
    const id = (originalSetInterval as (...values: unknown[]) => number)(handler, timeout, ...args);
    timerIds.add(id);
    return id;
  };

  window.setTimeout = trackTimeout as typeof window.setTimeout;
  window.setInterval = trackInterval as typeof window.setInterval;
  window.clearTimeout = ((id?: number) => {
    if (id !== undefined) timerIds.delete(id);
    originalClearTimeout(id);
  }) as typeof window.clearTimeout;
  window.clearInterval = ((id?: number) => {
    if (id !== undefined) timerIds.delete(id);
    originalClearInterval(id);
  }) as typeof window.clearInterval;

  if (OriginalWebSocket) {
    class TrackedWebSocket extends OriginalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        openSockets.add(this);
        const closed = () => {
          openSockets.delete(this);
          removeListener(this, "close", closed);
          removeListener(this, "error", closed);
        };
        this.addEventListener("close", closed);
        this.addEventListener("error", closed);
      }
    }
    try {
      Object.defineProperty(window, "WebSocket", {
        configurable: true,
        writable: true,
        value: TrackedWebSocket,
      });
    } catch {
      // A hardened environment may lock the constructor; listener and timer
      // counts still work and the socket count stays at zero.
    }
  }

  restore = () => {
    EventTarget.prototype.addEventListener = originalAdd;
    EventTarget.prototype.removeEventListener = originalRemove;
    window.addEventListener = windowAdd;
    window.removeEventListener = windowRemove;
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
    window.setInterval = originalSetInterval;
    window.clearInterval = originalClearInterval;
    try {
      Object.defineProperty(window, "WebSocket", {
        configurable: true,
        writable: true,
        value: OriginalWebSocket,
      });
    } catch {
      // See above.
    }
    installed = false;
    listenerKeys.clear();
    timerIds.clear();
    openSockets.clear();
    restore = null;
  };
  return restore;
}

export function readLeakCounts(): LeakCounts {
  let listeners = 0;
  const byType: Record<string, number> = {};
  for (const types of listenerKeys.values()) {
    for (const [type, set] of types) {
      listeners += set.size;
      byType[type] = (byType[type] ?? 0) + set.size;
    }
  }
  return { listeners, timers: timerIds.size, sockets: openSockets.size, byType };
}

/** Test seam: reset counts between cases. */
export function resetLeakCounters(): void {
  listenerKeys.clear();
  timerIds.clear();
  openSockets.clear();
}

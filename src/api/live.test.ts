import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveSocketManager, type LiveSocketLike } from "./live";
import { positionFrame } from "../mocks/fixtures/live";

class FakeSocket implements LiveSocketLike {
  closed = false;
  readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("live socket manager", () => {
  it("stays down until the first socket opens", () => {
    const socket = new FakeSocket();
    const manager = new LiveSocketManager({
      createSocket: () => socket,
      onFrame: vi.fn(),
      resync: () => Promise.resolve(),
    });
    manager.start();
    expect(manager.getState()).toBe("down");
    manager.stop();
  });

  it("resyncs the snapshot before applying buffered frames", async () => {
    const socket = new FakeSocket();
    const frames: string[] = [];
    let finishResync: () => void = () => undefined;
    const resync = new Promise<void>((resolve) => {
      finishResync = () => resolve();
    });
    const manager = new LiveSocketManager({
      createSocket: () => socket,
      onFrame: (frame) => frames.push(frame),
      resync: () => resync,
    });

    manager.start();
    socket.emit("open");
    socket.emit("message", { data: JSON.stringify(positionFrame) });
    await flush();
    expect(frames).toHaveLength(0);

    finishResync();
    await flush();
    expect(frames).toHaveLength(1);
    expect(frames[0]).toBe(JSON.stringify(positionFrame));
    expect(manager.getState()).toBe("live");
    manager.stop();
  });

  it("forwards raw payloads and leaves validation to the frame batch", () => {
    const socket = new FakeSocket();
    const onFrame = vi.fn();
    const manager = new LiveSocketManager({
      createSocket: () => socket,
      onFrame,
      resync: () => Promise.resolve(),
    });
    manager.start();
    socket.emit("message", { data: "{not json" });
    expect(onFrame).toHaveBeenCalledWith("{not json");
    expect(socket.closed).toBe(false);
    manager.stop();
  });

  it("reconnects with backoff after a close", async () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    const manager = new LiveSocketManager({
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      onFrame: vi.fn(),
      resync: () => Promise.resolve(),
      random: () => 0,
    });
    manager.start();
    expect(sockets).toHaveLength(1);
    sockets[0]?.emit("close");
    expect(manager.getState()).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets).toHaveLength(2);
    manager.stop();
  });

  it("retries immediately when asked and keeps the current backoff", () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    const manager = new LiveSocketManager({
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      onFrame: vi.fn(),
      resync: () => Promise.resolve(),
      random: () => 0,
    });
    manager.start();
    sockets[0]?.emit("close");
    expect(sockets).toHaveLength(1);

    manager.retryNow();
    expect(sockets).toHaveLength(2);

    sockets[1]?.emit("close");
    expect(manager.getState()).toBe("reconnecting");
    vi.advanceTimersByTime(1_999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
    manager.stop();
  });

  it("stays down while offline and reconnects when online returns", () => {
    vi.useFakeTimers();
    let online = true;
    const sockets: FakeSocket[] = [];
    const manager = new LiveSocketManager({
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      onFrame: vi.fn(),
      resync: () => Promise.resolve(),
      isOnline: () => online,
    });
    manager.start();
    expect(sockets).toHaveLength(1);
    online = false;
    sockets[0]?.emit("close");
    expect(manager.getState()).toBe("down");
    vi.advanceTimersByTime(30_000);
    expect(sockets).toHaveLength(1);

    online = true;
    manager.notifyOnline();
    expect(sockets).toHaveLength(2);
    manager.stop();
  });

  it("quiets on an offline notification and only resumes when online", () => {
    vi.useFakeTimers();
    let online = true;
    const sockets: FakeSocket[] = [];
    const manager = new LiveSocketManager({
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      onFrame: vi.fn(),
      resync: () => Promise.resolve(),
      isOnline: () => online,
    });
    manager.start();
    expect(sockets).toHaveLength(1);

    online = false;
    manager.notifyOffline();
    expect(manager.getState()).toBe("down");
    vi.advanceTimersByTime(30_000);
    expect(sockets).toHaveLength(1);

    manager.notifyOnline();
    expect(sockets).toHaveLength(1);

    online = true;
    manager.notifyOnline();
    expect(sockets).toHaveLength(2);
    manager.stop();
  });

  it("backs off when the snapshot resync keeps failing", async () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    const manager = new LiveSocketManager({
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      onFrame: vi.fn(),
      resync: () => Promise.reject(new Error("snapshot unavailable")),
      random: () => 0,
    });

    manager.start();
    sockets[0]?.emit("open");
    await vi.advanceTimersByTimeAsync(0);
    expect(manager.getState()).toBe("reconnecting");

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets).toHaveLength(2);

    sockets[1]?.emit("open");
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets).toHaveLength(3);
    manager.stop();
  });

  it("ignores a resync that finishes after the socket closed", async () => {
    const socket = new FakeSocket();
    const frames: string[] = [];
    let finishResync: () => void = () => undefined;
    const resync = new Promise<void>((resolve) => {
      finishResync = () => resolve();
    });
    const manager = new LiveSocketManager({
      createSocket: () => socket,
      onFrame: (frame) => frames.push(frame),
      resync: () => resync,
      random: () => 0,
    });

    manager.start();
    socket.emit("open");
    socket.emit("message", { data: JSON.stringify(positionFrame) });
    socket.emit("close");

    finishResync();
    await flush();

    expect(frames).toHaveLength(0);
    expect(manager.getState()).toBe("reconnecting");
    manager.stop();
  });

  it("drops buffered frames when stopped during a resync", async () => {
    const socket = new FakeSocket();
    const frames: string[] = [];
    let finishResync: () => void = () => undefined;
    const resync = new Promise<void>((resolve) => {
      finishResync = () => resolve();
    });
    const manager = new LiveSocketManager({
      createSocket: () => socket,
      onFrame: (frame) => frames.push(frame),
      resync: () => resync,
    });

    manager.start();
    socket.emit("open");
    socket.emit("message", { data: JSON.stringify(positionFrame) });
    manager.stop();

    finishResync();
    await flush();

    expect(frames).toHaveLength(0);
    expect(manager.getState()).toBe("down");
  });
});

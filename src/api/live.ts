export type SocketState = "live" | "reconnecting" | "down";

export interface LiveSocketLike {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  close(): void;
}

export interface LiveSocketOptions {
  createSocket: () => LiveSocketLike;
  /** Raw payload. Parsing and schema validation happen inside the frame batch. */
  onFrame: (raw: string) => void;
  resync: () => Promise<void>;
  onState?: (state: SocketState) => void;
  isOnline?: () => boolean;
  random?: () => number;
  now?: () => number;
}

const MAX_BUFFER = 1_000;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

function messageData(event: unknown): string | null {
  if (typeof event !== "object" || event === null || !("data" in event)) return null;
  const data = (event as { data?: unknown }).data;
  return typeof data === "string" ? data : null;
}

export class LiveSocketManager {
  private socket: LiveSocketLike | null = null;
  private state: SocketState = "down";
  private stopped = true;
  private resyncing = false;
  private buffer: string[] = [];
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly online: () => boolean;
  private readonly options: LiveSocketOptions;

  constructor(options: LiveSocketOptions) {
    this.options = options;
    this.online = options.isOnline ?? (() => navigator.onLine);
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
    this.clearTimer();
    this.buffer = [];
    this.resyncing = false;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.setState("down");
  }

  getState(): SocketState {
    return this.state;
  }

  notifyOnline(): void {
    if (this.stopped) return;
    this.connect();
  }

  private readonly handleOnline = () => {
    this.connect();
  };

  private readonly handleOffline = () => {
    this.clearTimer();
    const socket = this.socket;
    this.socket = null;
    this.buffer = [];
    this.resyncing = false;
    socket?.close();
    this.setState("down");
  };

  private connect(): void {
    if (this.stopped || this.socket) return;
    if (!this.online()) {
      this.setState("down");
      return;
    }

    this.clearTimer();
    const socket = this.options.createSocket();
    this.socket = socket;

    socket.addEventListener("open", () => {
      void this.handleOpen(socket);
    });
    socket.addEventListener("message", (event) => {
      this.handleMessage(socket, event);
    });
    socket.addEventListener("close", () => {
      this.handleClose(socket);
    });
  }

  private async handleOpen(socket: LiveSocketLike): Promise<void> {
    this.resyncing = true;
    try {
      await this.options.resync();
    } catch {
      if (this.stopped || this.socket !== socket) return;
      this.resyncing = false;
      this.socket = null;
      socket.close();
      this.setState("reconnecting");
      this.scheduleReconnect();
      return;
    }

    if (this.stopped || this.socket !== socket) return;

    this.resyncing = false;
    this.attempt = 0;
    this.setState("live");
    const buffered = this.buffer;
    this.buffer = [];
    for (const raw of buffered) this.options.onFrame(raw);
  }

  private handleMessage(socket: LiveSocketLike, event: unknown): void {
    if (this.stopped || this.socket !== socket) return;

    const raw = messageData(event);
    if (raw === null) return;

    if (this.resyncing) {
      this.buffer = [...this.buffer.slice(-(MAX_BUFFER - 1)), raw];
      return;
    }

    this.options.onFrame(raw);
  }

  private handleClose(socket: LiveSocketLike): void {
    if (this.socket !== socket) return;
    this.socket = null;
    this.resyncing = false;
    this.buffer = [];
    if (this.stopped) return;
    if (!this.online()) {
      this.setState("down");
      return;
    }
    this.setState("reconnecting");
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.clearTimer();
    const base = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** this.attempt);
    const jitter = (this.options.random ?? Math.random)() * base * 0.2;
    this.attempt += 1;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, base + jitter);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private setState(next: SocketState): void {
    if (this.state === next) return;
    this.state = next;
    this.options.onState?.(next);
  }
}

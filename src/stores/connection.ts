import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { onlineManager } from "@tanstack/react-query";
import { useNow } from "../lib/ticker";
import { setReportedOnline } from "../errors/report";

export type NetworkState = "online" | "offline";
export type SocketState = "live" | "reconnecting" | "down";

export interface ConnectionState {
  network: NetworkState;
  socket: SocketState;
  lastDataAt: number | null;
  socketDownAt: number | null;
  retryLive: () => void;
  setRetryLive: (retry: (() => void) | null) => void;
  setNetwork: (network: NetworkState) => void;
  setSocket: (socket: SocketState) => void;
  markData: (at: number) => void;
}

export interface ConnectivityOptions {
  probe?: () => Promise<boolean>;
  probeIntervalMs?: number;
}

export interface ConnectivityController {
  start: () => () => void;
  reportReachable: () => void;
  reportUnreachable: () => void;
  probeNow: () => Promise<void>;
}

const PROBE_INTERVAL_MS = 15_000;
const PROBE_TIMEOUT_MS = 5_000;

const noRetry = () => undefined;
let retryTarget: () => void = noRetry;
let frozen = false;

/** Dev-and-mock only: keeps a simulated connection state while the socket runs. */
export function freezeConnection(value: boolean): void {
  frozen = value;
}

function browserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  network: browserOnline() ? "online" : "offline",
  socket: "down",
  lastDataAt: null,
  socketDownAt: null,
  retryLive: () => {
    retryTarget();
    set({ socketDownAt: Date.now() });
  },
  setRetryLive: (retry) => {
    retryTarget = retry ?? noRetry;
  },
  setNetwork: (network) => {
    if (frozen) return;
    set({ network });
  },
  setSocket: (socket) =>
    set((state) => {
      if (frozen) return state;
      if (socket === state.socket) return state;
      if (socket === "live") return { socket, socketDownAt: null };
      return { socket, socketDownAt: state.socketDownAt ?? Date.now() };
    }),
  markData: (at) => set({ lastDataAt: at }),
}));

export function resetConnection(): void {
  retryTarget = noRetry;
  frozen = false;
  const network = browserOnline() ? "online" : "offline";
  useConnectionStore.setState({
    network,
    socket: "down",
    lastDataAt: null,
    socketDownAt: null,
  });
  onlineManager.setOnline(network === "online");
  setReportedOnline(network === "online");
}

export function useConnection() {
  return useConnectionStore(
    useShallow((state) => ({
      network: state.network,
      socket: state.socket,
      lastDataAt: state.lastDataAt,
      socketDownAt: state.socketDownAt,
    })),
  );
}

export function useDataAge(): number | null {
  const lastDataAt = useConnectionStore((state) => state.lastDataAt);
  const now = useNow();
  if (lastDataAt === null) return null;
  return Math.max(0, Math.floor((now - lastDataAt) / 1000));
}

function applyNetwork(next: NetworkState): void {
  const before = useConnectionStore.getState().network;
  useConnectionStore.getState().setNetwork(next);
  const after = useConnectionStore.getState().network;
  onlineManager.setOnline(after === "online");
  setReportedOnline(after === "online");
  if (after === before) return;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("fleet:connectivity", { detail: { online: after === "online" } }));
  }
}

async function fetchProbe(): Promise<boolean> {
  if (typeof fetch !== "function") return false;
  const base = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${base}/api/v1/me`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function createConnectivity(options: ConnectivityOptions = {}): ConnectivityController {
  const probe = options.probe ?? fetchProbe;
  const intervalMs = options.probeIntervalMs ?? PROBE_INTERVAL_MS;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let started = false;

  const stopLoop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const startLoop = () => {
    if (timer !== null) return;
    timer = setInterval(() => void probeNow(), intervalMs);
  };

  const probeNow = async (): Promise<void> => {
    if (inFlight) return;
    inFlight = true;
    let reachable = false;
    try {
      reachable = await probe();
    } finally {
      inFlight = false;
    }
    if (reachable) {
      stopLoop();
      applyNetwork("online");
    } else {
      applyNetwork("offline");
      startLoop();
    }
  };

  const reportReachable = () => {
    stopLoop();
    applyNetwork("online");
  };

  const reportUnreachable = () => {
    applyNetwork("offline");
    startLoop();
  };

  const handleOffline = () => {
    applyNetwork("offline");
    startLoop();
  };

  const handleOnline = () => {
    void probeNow();
  };

  const handleVisibility = () => {
    if (document.visibilityState === "visible" && useConnectionStore.getState().network === "offline") {
      void probeNow();
    }
  };

  const start = (): (() => void) => {
    if (!started && typeof window !== "undefined") {
      started = true;
      window.addEventListener("offline", handleOffline);
      window.addEventListener("online", handleOnline);
      document.addEventListener("visibilitychange", handleVisibility);
      onlineManager.setOnline(useConnectionStore.getState().network === "online");
      if (!browserOnline()) {
        applyNetwork("offline");
        startLoop();
      } else {
        void probeNow();
      }
    }

    return () => {
      started = false;
      stopLoop();
      if (typeof window !== "undefined") {
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("online", handleOnline);
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  };

  return { start, reportReachable, reportUnreachable, probeNow };
}

const defaultConnectivity = createConnectivity();

/** Browser events, failed fetches and the periodic probe are the only source of truth. */
export function installNetworkListeners(): () => void {
  return defaultConnectivity.start();
}

/** A reachable HTTP response, whatever its status, proves the server is there. */
export function reportFetchReachable(): void {
  defaultConnectivity.reportReachable();
}

export function reportFetchUnreachable(): void {
  defaultConnectivity.reportUnreachable();
}

export function probeConnectivityNow(): Promise<void> {
  return defaultConnectivity.probeNow();
}

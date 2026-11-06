import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useNow } from "../lib/ticker";

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

const noRetry = () => undefined;
let retryTarget: () => void = noRetry;

export const useConnectionStore = create<ConnectionState>((set) => ({
  network: typeof navigator === "undefined" || navigator.onLine ? "online" : "offline",
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
  setNetwork: (network) => set({ network }),
  setSocket: (socket) =>
    set((state) => {
      if (socket === state.socket) return state;
      if (socket === "live") return { socket, socketDownAt: null };
      return { socket, socketDownAt: state.socketDownAt ?? Date.now() };
    }),
  markData: (at) => set({ lastDataAt: at }),
}));

export function resetConnection(): void {
  retryTarget = noRetry;
  useConnectionStore.setState({
    network: typeof navigator === "undefined" || navigator.onLine ? "online" : "offline",
    socket: "down",
    lastDataAt: null,
    socketDownAt: null,
  });
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

export function installNetworkListeners(): () => void {
  const update = () => {
    useConnectionStore
      .getState()
      .setNetwork(navigator.onLine ? "online" : "offline");
  };

  update();
  window.addEventListener("online", update);
  window.addEventListener("offline", update);

  return () => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  };
}

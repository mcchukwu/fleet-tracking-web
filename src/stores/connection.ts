import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useNow } from "../lib/ticker";

export type NetworkState = "online" | "offline";
export type SocketState = "live" | "reconnecting" | "down";

export interface ConnectionState {
  network: NetworkState;
  socket: SocketState;
  lastDataAt: number | null;
  setNetwork: (network: NetworkState) => void;
  setSocket: (socket: SocketState) => void;
  markData: (at: number) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  network: typeof navigator === "undefined" || navigator.onLine ? "online" : "offline",
  socket: "down",
  lastDataAt: null,
  setNetwork: (network) => set({ network }),
  setSocket: (socket) => set({ socket }),
  markData: (at) => set({ lastDataAt: at }),
}));

export function useConnection() {
  return useConnectionStore(
    useShallow((state) => ({
      network: state.network,
      socket: state.socket,
      lastDataAt: state.lastDataAt,
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

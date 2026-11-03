import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installNetworkListeners,
  useConnectionStore,
  type ConnectionState,
} from "./connection";
import { resetTicker } from "../lib/ticker";

afterEach(() => {
  resetTicker();
  useConnectionStore.setState({ network: "online", socket: "down", lastDataAt: null });
  vi.useRealTimers();
});

describe("connection store", () => {
  it("records socket and data age changes", () => {
    useConnectionStore.getState().setSocket("live");
    useConnectionStore.getState().markData(1_000);
    const state: ConnectionState = useConnectionStore.getState();
    expect(state.socket).toBe("live");
    expect(state.lastDataAt).toBe(1_000);
  });

  it("follows browser online and offline events", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const cleanup = installNetworkListeners();
    expect(useConnectionStore.getState().network).toBe("online");

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    window.dispatchEvent(new Event("offline"));
    expect(useConnectionStore.getState().network).toBe("offline");

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    expect(useConnectionStore.getState().network).toBe("online");
    cleanup();
  });
});

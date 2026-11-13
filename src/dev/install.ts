import {
  debugEnabled,
  readMapDebug,
  readPlaybackDebug,
  readPwaDebug,
  registerDebugSnapshot,
} from "./debug";
import { recordRequestFailure, resetErrorStorm } from "../errors/global";
import { freezeConnection, useConnectionStore, type ConnectionState } from "../stores/connection";
import { useLiveStore } from "../stores/live";

type ConnectionPatch = Partial<Pick<ConnectionState, "network" | "socket" | "socketDownAt">>;

declare global {
  interface Window {
    /** Dev-and-mock only: drives connection states that would take a minute to reach. */
    __FLEET_TEST_CONNECTION__?: (patch: ConnectionPatch) => void;
    /** Dev-and-mock only: raises or clears the error storm without three failing queries. */
    __FLEET_TEST_STORM__?: (active: boolean) => void;
  }
}

export function installDebugHook(): () => void {
  const unregister = registerDebugSnapshot(() => {
    const connection = useConnectionStore.getState();
    const live = useLiveStore.getState();
    return {
      live: {
        positions: live.positions,
        version: live.version,
        frameCount: live.frameCount,
        batchCount: live.batchCount,
        unknownKeys: live.unknownKeys,
      },
      connection: {
        network: connection.network,
        socket: connection.socket,
        lastDataAt: connection.lastDataAt,
        socketDownAt: connection.socketDownAt,
      },
      map: readMapDebug(),
      playback: readPlaybackDebug(),
      pwa: readPwaDebug(),
    };
  });

  if (!debugEnabled()) return unregister;
  Object.defineProperty(window, "__FLEET_TEST_CONNECTION__", {
    configurable: true,
    enumerable: false,
    value: (patch: ConnectionPatch) => {
      freezeConnection(true);
      useConnectionStore.setState(patch);
    },
  });
  Object.defineProperty(window, "__FLEET_TEST_STORM__", {
    configurable: true,
    enumerable: false,
    value: (active: boolean) => {
      if (!active) {
        resetErrorStorm();
        return;
      }
      recordRequestFailure("layers-a", "server");
      recordRequestFailure("layers-b", "network");
      recordRequestFailure("layers-c", "unavailable");
    },
  });

  return () => {
    unregister();
    Reflect.deleteProperty(window, "__FLEET_TEST_CONNECTION__");
    Reflect.deleteProperty(window, "__FLEET_TEST_STORM__");
  };
}

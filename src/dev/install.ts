import { readMapDebug, registerDebugSnapshot } from "./debug";
import { useConnectionStore } from "../stores/connection";
import { useLiveStore } from "../stores/live";

export function installDebugHook(): () => void {
  return registerDebugSnapshot(() => {
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
    };
  });
}

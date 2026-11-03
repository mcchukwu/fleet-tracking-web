import { registerDebugSnapshot } from "./debug";
import { useConnectionStore } from "../stores/connection";

export function installDebugHook(): () => void {
  return registerDebugSnapshot(() => {
    const connection = useConnectionStore.getState();
    return {
      live: {},
      connection: {
        network: connection.network,
        socket: connection.socket,
        lastDataAt: connection.lastDataAt,
      },
      map: {
        mapLoaded: false,
        renderedVehicleCount: 0,
        viewport: null,
      },
    };
  });
}

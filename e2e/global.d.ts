export {};

declare global {
  interface Window {
    __FLEET_DEBUG__?: {
      live: Record<string, unknown>;
      connection: {
        network: "online" | "offline";
        socket: "live" | "reconnecting" | "down";
        lastDataAt: number | null;
      };
      map: {
        mapLoaded: boolean;
        renderedVehicleCount: number;
        viewport: { center: [number, number]; zoom: number } | null;
      };
    } | null;
  }
}

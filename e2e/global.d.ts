export {};

declare global {
  interface Window {
    __FLEET_DEBUG__?: {
      live: {
        positions: Record<
          string,
          {
            lat: number;
            lon: number;
            recordedAt: string;
            positionAt: number;
            speedKph: number | null;
            headingDeg: number | null;
            alertMarkedAt: number | null;
          }
        >;
        version: number;
        frameCount: number;
        batchCount: number;
        unknownKeys: number;
      };
      connection: {
        network: "online" | "offline";
        socket: "live" | "reconnecting" | "down";
        lastDataAt: number | null;
        socketDownAt: number | null;
      };
      map: {
        mapLoaded: boolean;
        provider: string | null;
        renderedVehicleCount: number;
        viewport: { center: [number, number]; zoom: number } | null;
        bounds: { south: number; west: number; north: number; east: number } | null;
        selectedKey: string | null;
        hoveredKey: string | null;
        fitBounds: { south: number; west: number; north: number; east: number } | null;
        fitCount: number;
        geofenceCount: number;
      };
    } | null;
  }
}

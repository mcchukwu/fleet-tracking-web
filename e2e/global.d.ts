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
        targetVehicleCount: number;
        viewport: { center: [number, number]; zoom: number; bearing: number } | null;
        bounds: { south: number; west: number; north: number; east: number } | null;
        bearing: number | null;
        baseStyle: string | null;
        styleState: "loading" | "ready" | "error" | null;
        activeStyle: string | null;
        selectedKey: string | null;
        hoveredKey: string | null;
        fitBounds: { south: number; west: number; north: number; east: number } | null;
        fitCount: number;
        geofenceCount: number;
        stale: boolean;
      };
      playback: {
        vehicleId: string | null;
        from: string | null;
        to: string | null;
        resolution: string | null;
        pointCount: number;
        gapCount: number;
        eventCount: number;
        cursorIndex: number | null;
        cursorPosition: [number, number] | null;
        playheadMs: number | null;
        playing: boolean;
        speed: number;
        inGap: boolean;
        cancelled: boolean;
        reducedMotion: boolean;
      };
    } | null;
    __FLEET_TEST_MAP__?: {
      flyTo: (point: [number, number], zoom?: number) => void;
      getViewport: () => {
        center: [number, number];
        zoom: number;
        bearing: number;
        bounds: { south: number; west: number; north: number; east: number };
      };
      draw?: {
        testSetRing?: (ring: [number, number][]) => void;
        testAddVertex?: (point: [number, number]) => void;
        getGeometry: () => { type: "Polygon"; coordinates: number[][][] } | null;
      };
    } | null;
    __FLEET_TEST_CONNECTION__?: (patch: {
      network?: "online" | "offline";
      socket?: "live" | "reconnecting" | "down";
      socketDownAt?: number | null;
    }) => void;
    __FLEET_TEST_STORM__?: (active: boolean) => void;
    __FLEET_TEST_VISUAL_VIEWPORT__?: {
      width: number;
      height: number;
      offsetTop: number;
      offsetLeft: number;
      scale: number;
      addEventListener: (type: string, listener: EventListener) => void;
      removeEventListener: (type: string, listener: EventListener) => void;
      dispatchEvent: (event: Event) => boolean;
    };
    __STYLE_TEST__?: { streets: number; satellite: number };
    __FLEET_MOCK_WRITES__?: Array<{ method: string; url: string; body: unknown }>;
  }
}

import { useEffect, useRef, useState } from "react";
import { ErrorState } from "../../../errors/ErrorState";
import type { AppError } from "../../../errors/types";
import { setMapDebug } from "../../../dev/debug";
import { FleetMap } from "../../../map/FleetMap";
import { mapConfig } from "../../../map/config";
import type {
  MapAdapter,
  MapGeofence,
  MapStyleId,
  MapVehicle,
  Viewport,
} from "../../../map/types";
import { LoadingBar } from "../../../ui/StatePanel";
import type { VehicleRow } from "../lib/filter";
import { MapTooltip } from "./MapTooltip";

export interface MapViewProps {
  vehicles: readonly MapVehicle[];
  geofences: readonly MapGeofence[];
  selectedKey: string | null;
  hoveredKey: string | null;
  hoveredRow: VehicleRow | null;
  hoverPoint: { x: number; y: number } | null;
  dimmed: boolean;
  baseStyle: MapStyleId;
  loading: boolean;
  error: AppError | null;
  hasData: boolean;
  showErrorOverlay: boolean;
  onRetry: () => void;
  onSelect: (key: string) => void;
  onHover: (hover: { key: string; point: { x: number; y: number } } | null) => void;
  onViewport: (viewport: Viewport) => void;
  onAdapterReady: (adapter: MapAdapter | null) => void;
}

/** Dev-only render-crash injection for the e2e fault matrix. */
const INJECT_CRASH =
  import.meta.env.DEV &&
  import.meta.env.VITE_MOCK === "1" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("crash") === "map";

export function MapView({  vehicles,
  geofences,
  selectedKey,
  hoveredKey,
  hoveredRow,
  hoverPoint,
  dimmed,
  baseStyle,
  loading,
  error,
  hasData,
  showErrorOverlay,
  onRetry,
  onSelect,
  onHover,
  onViewport,
  onAdapterReady,
}: MapViewProps) {
  const [adapter, setAdapter] = useState<MapAdapter | null>(null);
  const flownFor = useRef<string | null>(null);

  useEffect(() => {
    if (!adapter) return;
    const offClick = adapter.on("vehicleClick", (event) => onSelect(event.key));
    const offHover = adapter.on("vehicleHover", (event) => onHover(event));
    const offViewport = adapter.on("viewportChange", (event) => {
      onViewport(event);
      setMapDebug({
        viewport: { center: event.center, zoom: event.zoom, bearing: event.bearing },
        bearing: event.bearing,
        bounds: event.bounds,
      });
    });
    return () => {
      offClick();
      offHover();
      offViewport();
    };
  }, [adapter, onHover, onSelect, onViewport]);

  useEffect(() => {
    setMapDebug({
      targetVehicleCount: vehicles.length,
      selectedKey,
      hoveredKey,
      geofenceCount: geofences.length,
      baseStyle,
    });
  }, [vehicles.length, selectedKey, hoveredKey, geofences.length, baseStyle]);

  useEffect(() => {
    if (!adapter || !selectedKey) {
      flownFor.current = null;
      return;
    }
    if (flownFor.current === selectedKey) return;
    const vehicle = vehicles.find((item) => item.key === selectedKey);
    if (!vehicle) return;
    flownFor.current = selectedKey;
    const bounds = adapter.getViewport().bounds;
    const [lon, lat] = vehicle.position;
    const inside =
      lat >= bounds.south && lat <= bounds.north && lon >= bounds.west && lon <= bounds.east;
    if (!inside) adapter.flyTo(vehicle.position, Math.max(adapter.getViewport().zoom, 13));
  }, [adapter, selectedKey, vehicles]);

  function handleReady(ready: MapAdapter): void {
    setAdapter(ready);
    onAdapterReady(ready);
    const viewport = ready.getViewport();
    setMapDebug({
      mapLoaded: true,
      provider: ready.id,
      baseStyle,
      targetVehicleCount: vehicles.length,
      viewport: { center: viewport.center, zoom: viewport.zoom, bearing: viewport.bearing },
      bearing: viewport.bearing,
      bounds: viewport.bounds,
    });
  }

  function handleError(): void {
    setMapDebug({ mapLoaded: false });
  }

  if (INJECT_CRASH) throw new Error("Injected map crash");

  return (
    <div className="relative h-full w-full">
      <FleetMap
        className="absolute inset-0"
        vehicles={vehicles}
        geofences={geofences}
        bounds={mapConfig.defaultBounds}
        baseStyle={baseStyle}
        dimmed={dimmed}
        onReady={handleReady}
        onError={handleError}
      />

      {loading && !hasData ? (
        <div className="absolute inset-x-0 top-0 z-10">
          <LoadingBar label="Loading vehicles" />
        </div>
      ) : null}

      {error && !hasData && showErrorOverlay ? (
        <div
          data-testid="map-error-overlay"
          className="absolute inset-0 z-10 flex items-center justify-center bg-surface/90 p-4"
        >
          <ErrorState error={error} onRetry={onRetry} />
        </div>
      ) : null}

      {hoveredRow && hoverPoint ? <MapTooltip row={hoveredRow} point={hoverPoint} /> : null}
    </div>
  );
}

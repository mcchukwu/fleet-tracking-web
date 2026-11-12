import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import type { Alert, Geofence } from "../../../api/types";
import { ErrorState } from "../../../errors/ErrorState";
import { FleetMap, MapAttribution } from "../../../map";
import { mapOfflineConfigured } from "../../../map/config";
import { toMapGeofences } from "../../../map/geofences";
import type { MapAdapter, MapVehicle, Padding } from "../../../map/types";
import { Skeleton } from "../../../ui/StatePanel";
import type { AlertPositionState } from "../hooks/useAlertPosition";
import { boundsWithMinimumSpan, positionBounds } from "../lib/position";

const FIT_PADDING: Padding = { top: 24, right: 24, bottom: 24, left: 24 };

export interface AlertPositionMapProps {
  alert: Alert;
  state: AlertPositionState;
  geofence: Geofence | null;
  offline?: boolean;
  onRetry: () => void;
  adapter?: MapAdapter;
}

export function AlertPositionMap({
  alert,
  state,
  geofence,
  offline = false,
  onRetry,
  adapter,
}: AlertPositionMapProps) {
  const [map, setMap] = useState<MapAdapter | null>(null);
  const position =
    state.status === "evidence" || state.status === "history" ? state.position : null;
  const bounds = position
    ? boundsWithMinimumSpan(positionBounds(position, geofence))
    : null;
  const south = bounds?.south;
  const west = bounds?.west;
  const north = bounds?.north;
  const east = bounds?.east;

  useEffect(() => {
    if (!map || south === undefined || west === undefined || north === undefined || east === undefined) {
      return;
    }
    map.fitBounds({ south, west, north, east }, { animate: false, padding: FIT_PADDING });
  }, [map, south, west, north, east]);

  const mapCapability = adapter ?? map;
  const offlinePanel = offline && !(mapCapability?.capabilities.offline ?? mapOfflineConfigured());

  if (offlinePanel) {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface-2 text-center">
        <MapPin aria-hidden="true" className="size-5 text-subtle" strokeWidth={1.5} />
        <p className="text-sm text-muted">Map isn't available offline</p>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div
        aria-busy="true"
        aria-label="Loading position"
        className="flex h-40 items-center justify-center rounded-md border border-border bg-surface-2"
      >
        <Skeleton className="h-3 w-32" />
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface-2 text-center">
        <MapPin aria-hidden="true" className="size-5 text-subtle" strokeWidth={1.5} />
        <p className="text-sm text-muted">Position unavailable</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-md border border-border bg-surface-2">
        <ErrorState compact error={state.error} onRetry={onRetry} />
        <p className="pb-2 text-center text-xs text-muted">Position unavailable</p>
      </div>
    );
  }

  const vehicles: MapVehicle[] = [
    {
      key: alert.vehicle_id,
      position: [state.position.lon, state.position.lat],
      headingDeg: null,
      status: "alert",
      label: alert.plate,
      selected: true,
      hovered: false,
      stale: state.status === "history",
    },
  ];
  const geofences = geofence ? toMapGeofences([geofence], geofence.id) : [];

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <FleetMap
        {...(adapter ? { adapter } : {})}
        {...(bounds ? { bounds } : {})}
        onReady={setMap}
        variant="static"
        label="Alert position"
        vehicles={vehicles}
        geofences={geofences}
        className="h-40"
      />
      <div className="flex justify-end bg-surface px-2 py-1">
        <MapAttribution styleId="standard" />
      </div>
    </div>
  );
}

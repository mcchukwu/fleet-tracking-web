import { MapPin } from "lucide-react";
import type { Alert, Geofence } from "../../../api/types";
import { ErrorState } from "../../../errors/ErrorState";
import { FleetMap, MapAttribution } from "../../../map";
import { toMapGeofences } from "../../../map/geofences";
import type { MapAdapter, MapVehicle } from "../../../map/types";
import { Skeleton } from "../../../ui/StatePanel";
import type { AlertPositionState } from "../hooks/useAlertPosition";

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

  if (offline) {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface-2 text-center">
        <MapPin aria-hidden="true" className="size-5 text-subtle" strokeWidth={1.5} />
        <p className="text-sm text-muted">Map isn't available offline</p>
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

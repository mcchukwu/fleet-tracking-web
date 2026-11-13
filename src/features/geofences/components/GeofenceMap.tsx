import { useEffect, useRef } from "react";
import type { MapAdapter, MapGeofence } from "../../../map/types";
import { mapOfflineConfigured } from "../../../map/config";
import { FleetMap } from "../../../map/FleetMap";
import { MapAttribution } from "../../../map/MapAttribution";
import { GeofenceMapControls } from "./GeofenceMapControls";

export interface GeofenceMapProps {
  geofences: readonly MapGeofence[];
  /** The geofence being edited; its normal layer is hidden while a draw session is live. */
  editingId?: string | null;
  adapter: MapAdapter | null;
  offline: boolean;
  hint?: string;
  fitDisabled?: boolean;
  onAdapter: (adapter: MapAdapter | null) => void;
  onFitAll: () => void;
}

export function GeofenceMap({
  geofences,
  editingId = null,
  adapter,
  offline,
  hint,
  fitDisabled = false,
  onAdapter,
  onFitAll,
}: GeofenceMapProps) {
  const onAdapterRef = useRef(onAdapter);
  useEffect(() => {
    onAdapterRef.current = onAdapter;
  });

  useEffect(
    () => () => {
      onAdapterRef.current(null);
    },
    [],
  );

  const offlinePanel = offline && !(adapter?.capabilities.offline ?? mapOfflineConfigured());
  const styleState = adapter?.getStyleState();
  const drawn = editingId ? geofences.filter((row) => row.id !== editingId) : geofences;

  return (
    <div className="bg-surface-2 relative min-h-0 flex-1 overflow-hidden">
      {offlinePanel ? (
        <div className="bg-surface text-text flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
          <p className="text-base font-medium">Map isn't available offline</p>
          <p className="text-muted text-sm">The geofence list is still available.</p>
        </div>
      ) : (
        <FleetMap
          label="Geofence map"
          geofences={drawn}
          dimmed={offline}
          onReady={onAdapter}
          className="h-full"
        />
      )}

      {!offlinePanel ? (
        <>
          {hint ? (
            <output className="border-border bg-surface text-text shadow-float z-map-controls max-w-panel pointer-events-none absolute top-3 left-1/2 block -translate-x-1/2 rounded-md border px-3 py-2 text-center text-xs">
              {hint}
            </output>
          ) : null}
          <div className="z-map-controls absolute right-3 bottom-3 flex flex-col items-end gap-2">
            <GeofenceMapControls
              adapter={adapter}
              fitDisabled={fitDisabled || adapter === null}
              onFitAll={onFitAll}
            />
            <MapAttribution
              styleId={styleState?.style ?? "standard"}
              attribution={styleState?.attribution ?? null}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

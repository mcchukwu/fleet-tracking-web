import { useEffect, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { mapConfig } from "../../../map/config";
import type { MapAdapter, Viewport } from "../../../map/types";
import { IconButton } from "../../../ui/IconButton";
import { Tooltip } from "../../../ui/Tooltip";

export interface GeofenceMapControlsProps {
  adapter: MapAdapter | null;
  fitDisabled?: boolean;
  onFitAll: () => void;
}

export function GeofenceMapControls({
  adapter,
  fitDisabled = false,
  onFitAll,
}: GeofenceMapControlsProps) {
  const [eventViewport, setEventViewport] = useState<Viewport | null>(null);

  useEffect(() => {
    if (!adapter) {
      // oxlint-disable-next-line react/set-state-in-effect -- losing the adapter is an external reset event.
      setEventViewport(null);
      return;
    }
    // oxlint-disable-next-line react/set-state-in-effect -- the adapter's current viewport is an external snapshot.
    setEventViewport(adapter.getViewport());
    return adapter.on("viewportChange", setEventViewport);
  }, [adapter]);

  const zoom = (eventViewport ?? adapter?.getViewport() ?? null)?.zoom ?? null;
  const atMax = zoom !== null && zoom >= mapConfig.options.maxZoom;
  const atMin = zoom !== null && zoom <= mapConfig.options.minZoom;
  const fitLabel = fitDisabled ? "No geofences to fit" : "Fit all geofences";

  return (
    <fieldset
      aria-label="Map controls"
      className="border-border bg-surface shadow-float m-0 flex flex-col rounded-lg border p-1"
    >
      <Tooltip label={atMax ? "Maximum zoom" : "Zoom in"} side="left">
        <IconButton
          size="lg"
          variant="ghost"
          label={atMax ? "Maximum zoom" : "Zoom in"}
          disabled={!adapter || atMax}
          onClick={() => adapter?.zoomIn()}
          icon={<Plus aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        />
      </Tooltip>
      <Tooltip label={atMin ? "Minimum zoom" : "Zoom out"} side="left">
        <IconButton
          size="lg"
          variant="ghost"
          label={atMin ? "Minimum zoom" : "Zoom out"}
          disabled={!adapter || atMin}
          onClick={() => adapter?.zoomOut()}
          icon={<Minus aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        />
      </Tooltip>
      <Tooltip label={fitLabel} side="left">
        <IconButton
          size="lg"
          variant="ghost"
          label={fitLabel}
          disabled={!adapter || fitDisabled}
          onClick={onFitAll}
          icon={<Maximize2 aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        />
      </Tooltip>
    </fieldset>
  );
}

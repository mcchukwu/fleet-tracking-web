import { Maximize2, Minus, Plus } from "lucide-react";
import type { MapAdapter } from "../../../map/types";
import { IconButton } from "../../../ui/IconButton";

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
  return (
    <div className="flex flex-col gap-1">
      <IconButton
        label="Fit all geofences"
        variant="secondary"
        icon={<Maximize2 aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        disabled={fitDisabled}
        onClick={onFitAll}
      />
      <IconButton
        label="Zoom in"
        variant="secondary"
        icon={<Plus aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        disabled={!adapter}
        onClick={() => adapter?.zoomIn()}
      />
      <IconButton
        label="Zoom out"
        variant="secondary"
        icon={<Minus aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        disabled={!adapter}
        onClick={() => adapter?.zoomOut()}
      />
    </div>
  );
}

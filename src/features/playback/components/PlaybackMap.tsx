import { FleetMap } from "../../../map/FleetMap";
import type { MapAdapter, MapRoute } from "../../../map/types";
import { cn } from "../../../ui/cn";

export interface PlaybackMapProps {
  route: MapRoute | null;
  offline: boolean;
  onReady: (adapter: MapAdapter | null) => void;
  className?: string;
}

export function PlaybackMap({ route, offline, onReady, className }: PlaybackMapProps) {
  return (
    <div className={cn("absolute inset-0", className)}>
      <FleetMap
        label="Playback map"
        variant="full"
        baseStyle="standard"
        route={route}
        dimmed={offline}
        onReady={onReady}
        className="h-full"
      />
    </div>
  );
}

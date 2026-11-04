import { Layers, Maximize2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { mapConfig } from "../../../map/config";
import { IconButton } from "../../../ui/IconButton";
import { Tooltip } from "../../../ui/Tooltip";
import { cn } from "../../../ui/cn";

export interface MapControlsProps {
  panelOpen: boolean;
  geofencesVisible: boolean;
  fitDisabled?: boolean;
  onFit: () => void;
  onTogglePanel: () => void;
  onToggleGeofences: () => void;
  className?: string;
}

export function MapControls({
  panelOpen,
  geofencesVisible,
  fitDisabled = false,
  onFit,
  onTogglePanel,
  onToggleGeofences,
  className,
}: MapControlsProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-1 shadow-float">
        <Tooltip label="Fit the fleet">
          <IconButton
            label="Fit the fleet"
            variant="ghost"
            disabled={fitDisabled}
            onClick={onFit}
            icon={<Maximize2 aria-hidden="true" className="size-4" strokeWidth={1.5} />}
          />
        </Tooltip>
        <Tooltip label={geofencesVisible ? "Hide geofences" : "Show geofences"}>
          <IconButton
            label={geofencesVisible ? "Hide geofences" : "Show geofences"}
            variant="ghost"
            aria-pressed={geofencesVisible}
            onClick={onToggleGeofences}
            className={geofencesVisible ? "bg-accent-soft text-accent-fg" : undefined}
            icon={<Layers aria-hidden="true" className="size-4" strokeWidth={1.5} />}
          />
        </Tooltip>
        <Tooltip label={panelOpen ? "Hide the vehicle panel" : "Show the vehicle panel"}>
          <IconButton
            label={panelOpen ? "Hide the vehicle panel" : "Show the vehicle panel"}
            variant="ghost"
            aria-expanded={panelOpen}
            onClick={onTogglePanel}
            icon={
              panelOpen ? (
                <PanelLeftClose aria-hidden="true" className="size-4" strokeWidth={1.5} />
              ) : (
                <PanelLeftOpen aria-hidden="true" className="size-4" strokeWidth={1.5} />
              )
            }
          />
        </Tooltip>
      </div>
      <a
        href={mapConfig.attribution.href}
        target="_blank"
        rel="noreferrer"
        className="flex h-touch items-center justify-center rounded-md bg-surface px-2 text-center text-xs text-muted shadow-float focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring md:h-auto md:py-1"
      >
        {mapConfig.attribution.label}
      </a>
    </div>
  );
}

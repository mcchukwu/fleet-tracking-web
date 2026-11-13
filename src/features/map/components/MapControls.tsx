import type { CSSProperties, Ref } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Compass,
  Layers,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { formatHeading } from "../../../lib/format";
import { mapConfig } from "../../../map/config";
import type { MapStyleId } from "../../../map/types";
import { IconButton } from "../../../ui/IconButton";
import { Tooltip } from "../../../ui/Tooltip";
import { cn } from "../../../ui/cn";
import { MapStyleMenu } from "./MapStyleMenu";

export interface MapControlsProps {
  variant: "desktop" | "mobile";
  bearing: number;
  zoom: number;
  styles: readonly MapStyleId[];
  baseStyle: MapStyleId;
  offline: boolean;
  styleLoading?: MapStyleId | null;
  obscured?: boolean;
  panelOpen: boolean;
  panelToggleReason?: string;
  geofencesVisible: boolean;
  fitDisabled?: boolean;
  panelToggleRef?: Ref<HTMLButtonElement>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetBearing: () => void;
  onFit: () => void;
  onTogglePanel: () => void;
  onToggleGeofences: () => void;
  onStyleChange: (id: MapStyleId) => void;
  onObscuredFocusLoss?: () => void;
  className?: string;
}

function bearingStyle(bearing: number): CSSProperties {
  return { transform: `rotate(${-bearing}deg)` };
}

export function MapControls({
  variant,
  bearing,
  zoom,
  styles,
  baseStyle,
  offline,
  styleLoading = null,
  obscured = false,
  panelOpen,
  panelToggleReason,
  geofencesVisible,
  fitDisabled = false,
  panelToggleRef,
  onZoomIn,
  onZoomOut,
  onResetBearing,
  onFit,
  onTogglePanel,
  onToggleGeofences,
  onStyleChange,
  onObscuredFocusLoss,
  className,
}: MapControlsProps) {
  const [styleOpen, setStyleOpen] = useState(false);
  const stackRef = useRef<HTMLFieldSetElement>(null);
  const maxZoom = mapConfig.options.maxZoom;
  const minZoom = mapConfig.options.minZoom;
  const atMax = zoom >= maxZoom;
  const atMin = zoom <= minZoom;
  const atNorth = ((bearing % 360) + 360) % 360 === 0;
  const bearingText = atNorth ? "Facing north" : `Facing ${formatHeading(bearing)}`;
  const bearingLabel = `Reset bearing to north (${bearingText})`;
  const fitLabel = fitDisabled ? "No vehicles are reporting a position" : "Fit the fleet";

  const returnedFocusRef = useRef(false);

  useEffect(() => {
    if (!obscured) {
      returnedFocusRef.current = false;
      return;
    }
    // The opaque sheet cannot close a menu owned by an inert stack, so this is
    // the one place that can dismiss it when the stack goes away.
    // oxlint-disable-next-line react/set-state-in-effect
    setStyleOpen(false);
    if (returnedFocusRef.current) return;
    const active = document.activeElement;
    // An open menu renders in a portal, so its focused item is outside the
    // fieldset. Closing it would return focus to the now-inert trigger.
    const focusInMenu = active instanceof HTMLElement && active.closest('[role="menu"]') !== null;
    if (
      focusInMenu ||
      styleOpen ||
      (active instanceof HTMLElement && stackRef.current?.contains(active))
    ) {
      returnedFocusRef.current = true;
      onObscuredFocusLoss?.();
    }
  }, [obscured, onObscuredFocusLoss, styleOpen]);

  return (
    <fieldset
      ref={stackRef}
      aria-label="Map controls"
      {...(obscured ? { inert: true, "aria-hidden": true } : {})}
      className={cn(
        "map-controls m-0 flex min-w-0 flex-col gap-2 border-0 p-0",
        obscured && "pointer-events-none opacity-0",
        className,
      )}
    >
      <div className="border-border bg-surface shadow-float flex flex-col gap-1 rounded-lg border p-1">
        <Tooltip label={atMax ? "Maximum zoom" : "Zoom in"} side="left">
          <IconButton
            size="lg"
            variant="ghost"
            label={atMax ? "Maximum zoom" : "Zoom in"}
            disabled={atMax}
            onClick={onZoomIn}
            icon={<ZoomIn aria-hidden="true" className="size-4" strokeWidth={1.5} />}
          />
        </Tooltip>
        <Tooltip label={atMin ? "Minimum zoom" : "Zoom out"} side="left">
          <IconButton
            size="lg"
            variant="ghost"
            label={atMin ? "Minimum zoom" : "Zoom out"}
            disabled={atMin}
            onClick={onZoomOut}
            icon={<ZoomOut aria-hidden="true" className="size-4" strokeWidth={1.5} />}
          />
        </Tooltip>
        <Tooltip label={bearingLabel} side="left">
          <IconButton
            size="lg"
            variant="ghost"
            label={bearingLabel}
            className={atNorth ? "opacity-60" : undefined}
            onClick={onResetBearing}
            icon={
              <Compass
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.5}
                style={bearingStyle(bearing)}
              />
            }
          />
        </Tooltip>

        {variant === "desktop" ? (
          <>
            <Tooltip label={fitLabel} side="left">
              <IconButton
                size="lg"
                variant="ghost"
                label={fitLabel}
                disabled={fitDisabled}
                onClick={onFit}
                icon={<Maximize2 aria-hidden="true" className="size-4" strokeWidth={1.5} />}
              />
            </Tooltip>
            <Tooltip label={geofencesVisible ? "Hide geofences" : "Show geofences"} side="left">
              <IconButton
                size="lg"
                variant="ghost"
                label={geofencesVisible ? "Hide geofences" : "Show geofences"}
                aria-pressed={geofencesVisible}
                onClick={onToggleGeofences}
                className={geofencesVisible ? "bg-accent-soft text-accent-fg" : undefined}
                icon={<Layers aria-hidden="true" className="size-4" strokeWidth={1.5} />}
              />
            </Tooltip>
            <Tooltip
              label={
                panelToggleReason ??
                (panelOpen ? "Hide the vehicle panel" : "Show the vehicle panel")
              }
              side="left"
            >
              <IconButton
                ref={panelToggleRef}
                size="lg"
                variant="ghost"
                label={
                  panelToggleReason ??
                  (panelOpen ? "Hide the vehicle panel" : "Show the vehicle panel")
                }
                aria-expanded={panelOpen}
                aria-disabled={panelToggleReason ? true : undefined}
                disabled={false}
                onClick={() => {
                  if (!panelToggleReason) onTogglePanel();
                }}
                className={panelToggleReason ? "cursor-not-allowed opacity-60" : undefined}
                icon={
                  panelOpen ? (
                    <PanelLeftClose aria-hidden="true" className="size-4" strokeWidth={1.5} />
                  ) : (
                    <PanelLeftOpen aria-hidden="true" className="size-4" strokeWidth={1.5} />
                  )
                }
              />
            </Tooltip>
          </>
        ) : null}
      </div>

      <div className="border-border bg-surface shadow-float rounded-lg border p-1">
        <MapStyleMenu
          styles={styles}
          value={baseStyle}
          offline={offline}
          loadingStyle={styleLoading}
          variant="ghost"
          open={styleOpen}
          onOpenChange={setStyleOpen}
          onChange={onStyleChange}
        />
      </div>
    </fieldset>
  );
}

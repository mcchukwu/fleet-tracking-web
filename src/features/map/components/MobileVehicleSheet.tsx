import { ChevronUp, Layers, Maximize2 } from "lucide-react";
import type { CSSProperties, ReactNode, Ref, RefObject } from "react";
import { SearchInput } from "../../../ui/SearchInput";
import { IconButton } from "../../../ui/IconButton";
import { cn } from "../../../ui/cn";
import { useSheetDrag } from "../hooks/useSheetDrag";
import type { MapFilterValues } from "../lib/filter";
import { nextSheetSnap, toggleSheetSnap, type SheetSnap } from "../lib/sheet";
import { MobileFilterMenu } from "./MobileFilterMenu";

export type { SheetSnap } from "../lib/sheet";

function sheetVisibleStyle(visible: number): CSSProperties {
  return { "--sheet-visible": `${visible}px` } as CSSProperties;
}

export interface MobileVehicleSheetProps {
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  shown: number;
  total: number;
  filters: MapFilterValues;
  depots: readonly string[];
  geofencesVisible: boolean;
  fitDisabled?: boolean;
  insetTarget?: RefObject<HTMLElement | null>;
  handleRef?: Ref<HTMLButtonElement>;
  onFit: () => void;
  onToggleGeofences: () => void;
  onFilterChange: (patch: Partial<MapFilterValues>) => void;
  onResetFilters: () => void;
  onObscuredChange?: (obscured: boolean) => void;
  children: ReactNode;
}

export function MobileVehicleSheet({
  snap,
  onSnap,
  shown,
  total,
  filters,
  depots,
  geofencesVisible,
  fitDisabled = false,
  insetTarget,
  handleRef,
  onFit,
  onToggleGeofences,
  onFilterChange,
  onResetFilters,
  onObscuredChange,
  children,
}: MobileVehicleSheetProps) {
  const { sheetRef, visible, handlers } = useSheetDrag({
    snap,
    onSnap,
    ...(insetTarget ? { insetTarget } : {}),
    ...(onObscuredChange ? { onObscuredChange } : {}),
  });
  const fitLabel = fitDisabled
    ? "No vehicles are reporting a position"
    : "Fit the fleet";

  return (
    <section
      ref={sheetRef}
      aria-label="Vehicles"
      data-snap={snap}
      style={sheetVisibleStyle(visible)}
      className="mobile-sheet bg-surface shadow-float ring-border absolute inset-x-0 bottom-0 z-panel flex flex-col rounded-t-lg ring-1"
    >
      <div
        data-testid="sheet-header"
        className="h-sheet-peek border-border bg-surface relative z-map-controls flex shrink-0 touch-none flex-col border-b px-3"
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
      >
        <span
          aria-hidden="true"
          className="bg-border-strong mx-auto mt-1 h-1 w-8 rounded-full"
        />

        <div className="h-touch flex min-w-0 items-center gap-2">
          <button
            ref={handleRef}
            type="button"
            data-sheet-action
            aria-expanded={snap !== "peek"}
            aria-controls="mobile-vehicle-panel"
            className="h-touch focus-visible:outline-focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-0"
            onClick={() => onSnap(toggleSheetSnap(snap, "half"))}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                onSnap(nextSheetSnap(snap, 1));
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                onSnap(nextSheetSnap(snap, -1));
              }
              if (event.key === "Home") {
                event.preventDefault();
                onSnap("peek");
              }
              if (event.key === "End") {
                event.preventDefault();
                onSnap("full");
              }
            }}
          >
            <span className="text-md text-text shrink-0 font-medium">
              Vehicles
            </span>
            <span className="text-muted truncate text-xs tabular-nums">
              Showing {shown} of {total}
            </span>
            <ChevronUp
              aria-hidden="true"
              className={cn(
                "text-muted ml-auto size-4 shrink-0",
                snap === "peek" ? undefined : "rotate-180",
              )}
              strokeWidth={1.5}
            />
          </button>
          <span data-sheet-action>
            <IconButton
              size="sm"
              label={fitLabel}
              disabled={fitDisabled}
              onClick={onFit}
              icon={
                <Maximize2
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.5}
                />
              }
            />
          </span>
          <span data-sheet-action>
            <IconButton
              size="sm"
              label={geofencesVisible ? "Hide geofences" : "Show geofences"}
              aria-pressed={geofencesVisible}
              onClick={onToggleGeofences}
              className={
                geofencesVisible ? "bg-accent-soft text-accent-fg" : undefined
              }
              icon={
                <Layers
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.5}
                />
              }
            />
          </span>
          <span data-sheet-action>
            <MobileFilterMenu
              filters={filters}
              depots={depots}
              onChange={onFilterChange}
              onReset={onResetFilters}
            />
          </span>
        </div>

        <div className="flex h-15 min-w-0 items-center">
          <div data-sheet-action className="w-full min-w-0">
            <SearchInput
              compact
              value={filters.q}
              onChange={(q) => onFilterChange({ q })}
            />
          </div>
        </div>
      </div>

      <div
        id="mobile-vehicle-panel"
        data-testid="sheet-content"
        {...(snap === "peek" ? { inert: true, "aria-hidden": true } : {})}
        className="flex min-h-0 flex-1 flex-col"
      >
        {children}
      </div>
    </section>
  );
}

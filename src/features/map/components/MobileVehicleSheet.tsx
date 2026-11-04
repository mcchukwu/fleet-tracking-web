import { ChevronUp, Layers, Maximize2 } from "lucide-react";
import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { IconButton } from "../../../ui/IconButton";
import { cn } from "../../../ui/cn";

export type SheetSnap = "peek" | "half" | "full";

const SNAPS: readonly SheetSnap[] = ["peek", "half", "full"];

export function nextSheetSnap(snap: SheetSnap, direction: 1 | -1): SheetSnap {
  const index = SNAPS.indexOf(snap);
  const next = Math.min(SNAPS.length - 1, Math.max(0, index + direction));
  return SNAPS[next] ?? snap;
}

export function toggleSheetSnap(snap: SheetSnap, previous: Exclude<SheetSnap, "peek">): SheetSnap {
  return snap === "peek" ? previous : "peek";
}

export interface MobileVehicleSheetProps {
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  shown: number;
  total: number;
  geofencesVisible: boolean;
  onFit: () => void;
  onToggleGeofences: () => void;
  children: ReactNode;
}

export function MobileVehicleSheet({
  snap,
  onSnap,
  shown,
  total,
  geofencesVisible,
  onFit,
  onToggleGeofences,
  children,
}: MobileVehicleSheetProps) {
  const dragStart = useRef<number | null>(null);
  const previousSnap = useRef<Exclude<SheetSnap, "peek">>("half");

  useEffect(() => {
    if (snap !== "peek") previousSnap.current = snap;
  }, [snap]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    dragStart.current = event.clientY;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (dragStart.current === null) return;
    const delta = event.clientY - dragStart.current;
    dragStart.current = null;
    if (Math.abs(delta) < 40) return;
    onSnap(nextSheetSnap(snap, delta < 0 ? 1 : -1));
  }

  return (
    <section
      aria-label="Vehicles"
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-lg border-x border-t border-border bg-surface shadow-float",
        snap === "peek" ? "h-sheet-peek" : snap === "half" ? "h-1/2" : "h-full",
      )}
    >
      <div
        className="flex h-sheet-peek shrink-0 touch-none flex-col justify-center gap-1 border-b border-border px-3"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <span aria-hidden="true" className="mx-auto h-1 w-8 rounded-full bg-border-strong" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={snap !== "peek"}
            aria-controls={snap === "peek" ? undefined : "mobile-vehicle-panel"}
            className="flex h-touch min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
            onClick={() => onSnap(toggleSheetSnap(snap, previousSnap.current))}
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
            <span className="text-md font-medium text-text">Vehicles</span>
            <span className="truncate text-xs tabular-nums text-muted">
              Showing {shown} of {total}
            </span>
            <ChevronUp
              aria-hidden="true"
              className={cn("ml-auto size-4 text-muted", snap === "peek" ? undefined : "rotate-180")}
              strokeWidth={1.5}
            />
          </button>
          <IconButton
            label="Fit the fleet"
            size="sm"
            onClick={onFit}
            icon={<Maximize2 aria-hidden="true" className="size-4" strokeWidth={1.5} />}
          />
          <IconButton
            label={geofencesVisible ? "Hide geofences" : "Show geofences"}
            aria-pressed={geofencesVisible}
            size="sm"
            onClick={onToggleGeofences}
            className={geofencesVisible ? "bg-accent-soft text-accent-fg" : undefined}
            icon={<Layers aria-hidden="true" className="size-4" strokeWidth={1.5} />}
          />
        </div>
      </div>

      {snap === "peek" ? null : (
        <div id="mobile-vehicle-panel" className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      )}
    </section>
  );
}

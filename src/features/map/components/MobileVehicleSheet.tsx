import { ChevronUp, Layers, Maximize2 } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { SearchInput } from "../../../ui/SearchInput";
import { IconButton } from "../../../ui/IconButton";
import { cn } from "../../../ui/cn";
import type { MapFilterValues } from "../lib/filter";
import {
  clampVisible,
  isObscured,
  nearestSnap,
  nextSheetSnap,
  sheetMetrics,
  sheetVisible,
  toggleSheetSnap,
  type SheetSnap,
} from "../lib/sheet";
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
  onFit,
  onToggleGeofences,
  onFilterChange,
  onResetFilters,
  onObscuredChange,
  children,
}: MobileVehicleSheetProps) {
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight,
  );
  const metrics = useMemo(() => sheetMetrics(viewportHeight), [viewportHeight]);
  const visible = sheetVisible(snap, metrics);

  const sheetRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ startY: number; startVisible: number } | null>(null);
  const pendingRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const obscuredRef = useRef(false);
  const fitLabel = fitDisabled ? "No vehicles are reporting a position" : "Fit the fleet";

  function publish(candidate: number): number {
    const next = clampVisible(candidate, metrics);
    sheetRef.current?.style.setProperty("--sheet-visible", `${next}px`);
    insetTarget?.current?.style.setProperty("--map-inset-bottom", `${next}px`);
    const obscured = isObscured(next, metrics);
    if (obscured !== obscuredRef.current) {
      obscuredRef.current = obscured;
      onObscuredChange?.(obscured);
    }
    return next;
  }

  function flush(): void {
    if (pendingRef.current === null) return;
    publish(pendingRef.current);
  }

  function schedule(): void {
    if (typeof requestAnimationFrame !== "function") {
      flush();
      return;
    }
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      flush();
    });
  }

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const next = clampVisible(visible, metrics);
    sheetRef.current?.style.setProperty("--sheet-visible", `${next}px`);
    insetTarget?.current?.style.setProperty("--map-inset-bottom", `${next}px`);
    const obscured = isObscured(next, metrics);
    if (obscured !== obscuredRef.current) {
      obscuredRef.current = obscured;
      onObscuredChange?.(obscured);
    }
  }, [visible, metrics, insetTarget, onObscuredChange]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement;
    if (target.closest("[data-sheet-action]")) return;
    dragRef.current = { startY: event.clientY, startVisible: visible };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    insetTarget?.current?.setAttribute("data-sheet-dragging", "true");
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!dragRef.current) return;
    pendingRef.current = dragRef.current.startVisible + (dragRef.current.startY - event.clientY);
    schedule();
  }

  function endDrag(snapToNearest: boolean): void {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (frameRef.current !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const dragged = publish(pendingRef.current ?? visible);
    pendingRef.current = null;
    insetTarget?.current?.removeAttribute("data-sheet-dragging");
    if (snapToNearest) onSnap(nearestSnap(dragged, metrics));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (dragRef.current) {
      pendingRef.current =
        dragRef.current.startVisible + (dragRef.current.startY - event.clientY);
    }
    endDrag(true);
  }

  function onPointerCancel(): void {
    if (dragRef.current) pendingRef.current = visible;
    endDrag(false);
  }

  return (
    <section
      ref={sheetRef}
      aria-label="Vehicles"
      style={sheetVisibleStyle(visible)}
      className="mobile-sheet absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-lg border-x border-t border-border bg-surface shadow-float"
    >
      <div
        data-testid="sheet-header"
        className="flex h-sheet-peek shrink-0 touch-none flex-col justify-between border-b border-border px-3"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <span aria-hidden="true" className="mx-auto mt-1 h-1 w-8 rounded-full bg-border-strong" />

        <div className="flex h-touch min-w-0 items-center gap-2">
          <button
            type="button"
            data-sheet-action
            aria-expanded={snap !== "peek"}
            aria-controls="mobile-vehicle-panel"
            className="flex h-touch min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
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
            <span className="text-md font-medium text-text">Vehicles</span>
            <span className="truncate text-xs tabular-nums text-muted">
              Showing {shown} of {total}
            </span>
            <ChevronUp
              aria-hidden="true"
              className={cn(
                "ml-auto size-4 text-muted",
                snap === "peek" ? undefined : "rotate-180",
              )}
              strokeWidth={1.5}
            />
          </button>
          <span data-sheet-action>
            <MobileFilterMenu
              filters={filters}
              depots={depots}
              onChange={onFilterChange}
              onReset={onResetFilters}
            />
          </span>
        </div>

        <div className="flex h-touch min-w-0 items-center gap-2">
          <div data-sheet-action className="min-w-0 flex-1">
            <SearchInput
              compact
              value={filters.q}
              onChange={(q) => onFilterChange({ q })}
            />
          </div>
          <span data-sheet-action>
            <IconButton
              size="sm"
              label={fitLabel}
              disabled={fitDisabled}
              onClick={onFit}
              icon={<Maximize2 aria-hidden="true" className="size-4" strokeWidth={1.5} />}
            />
          </span>
          <span data-sheet-action>
            <IconButton
              size="sm"
              label={geofencesVisible ? "Hide geofences" : "Show geofences"}
              aria-pressed={geofencesVisible}
              onClick={onToggleGeofences}
              className={geofencesVisible ? "bg-accent-soft text-accent-fg" : undefined}
              icon={<Layers aria-hidden="true" className="size-4" strokeWidth={1.5} />}
            />
          </span>
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

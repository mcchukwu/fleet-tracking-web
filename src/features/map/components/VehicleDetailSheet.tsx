import { useEffect, useRef, type CSSProperties, type Ref, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronUp, Copy, X } from "lucide-react";
import type { SnapshotVehicle, Vehicle } from "../../../api/types";
import { useTrips } from "../../../api/hooks/trips";
import { useVehicle } from "../../../api/hooks/vehicles";
import { queryKeys } from "../../../api/keys";
import { SlowNotice } from "../../../errors/SlowNotice";
import { ErrorState } from "../../../errors/ErrorState";
import { normalize } from "../../../errors/normalize";
import { useDelayedFlag } from "../../../lib/useDelayedFlag";
import { Badge, StatusPill } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { CopyButton } from "../../../ui/CopyButton";
import { ForbiddenState } from "../../../ui/StatePanel";
import { cn } from "../../../ui/cn";
import { useSheetDrag } from "../hooks/useSheetDrag";
import type { VehicleRow } from "../lib/filter";
import { nextSheetSnap, toggleSheetSnap, type SheetSnap } from "../lib/sheet";
import { VehicleActions } from "./VehicleActions";
import { VehicleCurrentState } from "./VehicleCurrentState";
import { VehicleDetailsSection } from "./VehicleDetailsSection";
import { VehicleDrawerSkeleton } from "./VehicleDrawerSkeleton";
import { VehicleDriverSection } from "./VehicleDriverSection";
import { VehicleEventsSection } from "./VehicleEventsSection";
import { VehicleTripSection } from "./VehicleTripSection";

export interface VehicleDetailSheetProps {
  vehicleId: string;
  row: VehicleRow | null;
  snapshotVehicle: SnapshotVehicle | null;
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  mapReady: boolean;
  canMutate: boolean;
  offline: boolean;
  onClose: () => void;
  onCentre: (position?: { lat: number; lon: number }) => void;
  onPlayback: () => void;
  onEdit?: (vehicle: Vehicle) => void;
  onAssign?: (vehicle: Vehicle) => void;
  insetTarget?: RefObject<HTMLElement | null>;
  handleRef?: Ref<HTMLButtonElement>;
  onObscuredChange?: (obscured: boolean) => void;
}

/** Dev-only render-crash injection for the e2e fault matrix. */
const INJECT_CRASH =
  import.meta.env.DEV &&
  import.meta.env.VITE_MOCK === "1" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("crash") === "vehicle-drawer";

function sheetVisibleStyle(visible: number): CSSProperties {
  return { "--sheet-visible": `${visible}px` } as CSSProperties;
}

export function VehicleDetailSheet({
  vehicleId,
  row,
  snapshotVehicle,
  snap,
  onSnap,
  mapReady,
  canMutate,
  offline,
  onClose,
  onCentre,
  onPlayback,
  onEdit,
  onAssign,
  insetTarget,
  handleRef,
  onObscuredChange,
}: VehicleDetailSheetProps) {
  const queryClient = useQueryClient();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { sheetRef, visible, handlers } = useSheetDrag({
    snap,
    onSnap,
    ...(insetTarget ? { insetTarget } : {}),
    ...(onObscuredChange ? { onObscuredChange } : {}),
  });

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest('[role="dialog"]')) return;
      if (!(active instanceof Node) || !sheetRef.current?.contains(active)) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, sheetRef]);

  const vehicleQuery = useVehicle(vehicleId);
  const vehicle = vehicleQuery.data;
  const tripId = vehicle?.trip_id ?? snapshotVehicle?.trip_id;
  const tripQuery = useTrips({ limit: 500 }, { enabled: Boolean(tripId) });
  const trips = Array.isArray(tripQuery.data) ? tripQuery.data : undefined;
  const detailError = vehicleQuery.error && !offline ? normalize(vehicleQuery.error) : null;
  const notFound = detailError?.kind === "not_found";
  const forbidden = detailError?.kind === "forbidden";
  const plate = row?.plate ?? snapshotVehicle?.plate ?? vehicle?.plate ?? "Vehicle";
  const status = row?.status ?? (vehicle?.online ? "idle" : "offline");
  const lat = row?.lat ?? vehicle?.lat ?? null;
  const lon = row?.lon ?? vehicle?.lon ?? null;
  const hasPosition = lat !== null && lon !== null;
  const hasDetail = vehicle !== undefined && !notFound;
  const showDetailSkeleton = useDelayedFlag(vehicleQuery.isPending);

  function retryDetail(): void {
    void vehicleQuery.refetch();
  }

  if (INJECT_CRASH) throw new Error("Injected vehicle drawer crash");

  return (
    <section
      ref={sheetRef}
      aria-label={`Vehicle details for ${plate}`}
      data-snap={snap}
      data-testid="vehicle-detail-sheet"
      style={sheetVisibleStyle(visible)}
      className="mobile-sheet bg-surface shadow-float ring-border absolute inset-x-0 bottom-0 z-panel flex flex-col rounded-t-lg ring-1"
    >
      <h2 className="sr-only">Vehicle details for {plate}</h2>
      <div
        data-testid="detail-sheet-header"
        className="h-sheet-peek border-border bg-surface relative z-map-controls flex shrink-0 touch-none flex-col border-b px-3 pt-2"
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
      >
        <span aria-hidden="true" className="bg-border-strong mx-auto h-1 w-8 rounded-full" />

        <div className="mt-1 flex h-touch min-w-0 items-center gap-2">
          <button
            ref={handleRef}
            type="button"
            data-sheet-action
            aria-expanded={snap !== "peek"}
            aria-controls="mobile-vehicle-detail"
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
            <span className="truncate font-mono text-md font-medium text-text">{plate}</span>
            <StatusPill status={status} />
            {row?.stale ? <Badge tone="warning">Stale</Badge> : null}
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
            <CopyButton
              value={plate}
              label="Plate"
              className="w-touch justify-center rounded-md text-muted hover:bg-surface-2 md:w-control-sm"
            >
              <Copy aria-hidden="true" className="size-4" strokeWidth={1.5} />
            </CopyButton>
          </span>
          <span data-sheet-action>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close vehicle details"
              onClick={onClose}
              className="inline-flex size-touch items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-focus-ring md:size-control-sm"
            >
              <X aria-hidden="true" className="size-4" strokeWidth={1.5} />
            </button>
          </span>
        </div>

        <div className="mt-2 flex h-touch min-w-0 items-center">
          <span data-sheet-action>
            <VehicleActions
              variant="icons"
              onCentre={() => {
                onCentre(hasPosition && lat !== null && lon !== null ? { lat, lon } : undefined);
              }}
              onPlayback={onPlayback}
              onEdit={() => {
                if (vehicle) onEdit?.(vehicle);
              }}
              onAssign={() => {
                if (vehicle) onAssign?.(vehicle);
              }}
              mapReady={mapReady}
              hasPosition={hasPosition}
              canMutate={canMutate}
              offline={offline}
              hasVehicle={!notFound}
              canEdit={hasDetail}
            />
          </span>
        </div>
      </div>

      <div
        id="mobile-vehicle-detail"
        data-testid="detail-sheet-content"
        {...(snap === "peek" ? { inert: true, "aria-hidden": true } : {})}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {notFound ? (
          <div className="p-4">
            <p className="text-base font-medium text-text">Vehicle not found</p>
            <p className="mt-1 text-sm text-muted">It may have been removed.</p>
            <Button className="mt-4" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : forbidden ? (
          <ForbiddenState action={<Button onClick={onClose}>Close</Button>} />
        ) : detailError && !vehicle && !row ? (
          <div className="p-4">
            <ErrorState error={detailError} onRetry={retryDetail} />
          </div>
        ) : (
          <>
            {row ? <VehicleCurrentState row={row} vehicle={vehicle} /> : null}
            {vehicleQuery.isPending ? (
              <>
                <SlowNotice
                  onRetry={retryDetail}
                  onCancel={() =>
                    void queryClient.cancelQueries({ queryKey: queryKeys.vehicle(vehicleId) })
                  }
                />
                {showDetailSkeleton ? <VehicleDrawerSkeleton /> : null}
              </>
            ) : (
              <>
                {detailError && vehicle ? (
                  <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs text-muted">
                    <span>Couldn't refresh vehicle details.</span>
                    <button
                      type="button"
                      onClick={retryDetail}
                      className="h-touch rounded-sm px-2 font-medium text-accent-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus-ring md:h-control-sm"
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
                {detailError && !vehicle ? (
                  <div className="border-b border-border p-4">
                    <ErrorState compact error={detailError} onRetry={retryDetail} />
                  </div>
                ) : null}
                <VehicleTripSection
                  tripId={tripId}
                  snapshotVehicle={snapshotVehicle}
                  trips={trips}
                  tripQuery={tripQuery}
                  offline={offline}
                />
                <VehicleDriverSection
                  driverName={vehicle?.driver_name ?? row?.driverName}
                  driverPhone={vehicle?.driver_phone}
                />
                {vehicle ? <VehicleDetailsSection vehicle={vehicle} /> : null}
                <VehicleEventsSection vehicleId={vehicleId} offline={offline} />
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

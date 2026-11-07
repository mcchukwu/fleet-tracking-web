import type { SnapshotVehicle, Vehicle } from "../../../api/types";
import { useTrips } from "../../../api/hooks/trips";
import { useVehicle } from "../../../api/hooks/vehicles";
import { ErrorState } from "../../../errors/ErrorState";
import { normalize } from "../../../errors/normalize";
import { ForbiddenState } from "../../../ui/StatePanel";
import { Badge, StatusPill } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { CopyButton } from "../../../ui/CopyButton";
import { Drawer } from "../../../ui/Drawer";
import type { VehicleRow } from "../lib/filter";
import { VehicleActions } from "./VehicleActions";
import { VehicleCurrentState } from "./VehicleCurrentState";
import { VehicleDetailsSection } from "./VehicleDetailsSection";
import { VehicleDrawerSkeleton } from "./VehicleDrawerSkeleton";
import { VehicleDriverSection } from "./VehicleDriverSection";
import { VehicleEventsSection } from "./VehicleEventsSection";
import { VehicleTripSection } from "./VehicleTripSection";

export interface VehicleDrawerProps {
  vehicleId: string;
  row: VehicleRow | null;
  snapshotVehicle: SnapshotVehicle | null;
  mapReady: boolean;
  canMutate: boolean;
  offline: boolean;
  onClose: () => void;
  onCentre: () => void;
  onPlayback: () => void;
  onEdit?: (vehicle: Vehicle) => void;
  onAssign?: (vehicle: Vehicle) => void;
  returnFocus?: () => void;
}

export function VehicleDrawer({
  vehicleId,
  row,
  snapshotVehicle,
  mapReady,
  canMutate,
  offline,
  onClose,
  onCentre,
  onPlayback,
  onEdit,
  onAssign,
  returnFocus,
}: VehicleDrawerProps) {
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

  function retryDetail(): void {
    void vehicleQuery.refetch();
  }

  return (
    <Drawer
      open
      label={`Vehicle details for ${plate}`}
      title={<CopyButton value={plate} label="Plate" className="text-md" />}
      headerAside={
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          {row?.stale ? <Badge tone="warning">Stale</Badge> : null}
        </div>
      }
      actions={
        <VehicleActions
          onCentre={onCentre}
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
        />
      }
      onClose={onClose}
      returnFocus={returnFocus}
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
            <VehicleDrawerSkeleton />
          ) : (
            <>
              {detailError && !vehicle ? (
                <div className="border-b border-border p-4">
                  <ErrorState compact error={detailError} onRetry={retryDetail} />
                  <p className="mt-2 text-xs text-muted">
                    Live fields stay visible while the full record is unavailable.
                  </p>
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
    </Drawer>
  );
}

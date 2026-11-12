import { useQueryClient } from "@tanstack/react-query";
import type { SnapshotVehicle } from "../../../api/types";
import { useTrips } from "../../../api/hooks/trips";
import { useVehicle } from "../../../api/hooks/vehicles";
import { queryKeys } from "../../../api/keys";
import { useQueryView } from "../../../api/useQueryView";
import { ErrorState } from "../../../errors/ErrorState";
import { SlowNotice } from "../../../errors/SlowNotice";
import { normalize } from "../../../errors/normalize";
import { useDelayedFlag } from "../../../lib/useDelayedFlag";
import { Button } from "../../../ui/Button";
import { EmptyState, ForbiddenState } from "../../../ui/StatePanel";
import type { VehicleRow } from "../lib/filter";
import { VehicleCurrentState } from "./VehicleCurrentState";
import { VehicleDetailsSection } from "./VehicleDetailsSection";
import { VehicleDrawerSkeleton } from "./VehicleDrawerSkeleton";
import { VehicleDriverSection } from "./VehicleDriverSection";
import { VehicleEventsSection } from "./VehicleEventsSection";
import { VehicleTripSection } from "./VehicleTripSection";

export interface VehicleDetailBodyProps {
  vehicleId: string;
  row: VehicleRow | null;
  snapshotVehicle: SnapshotVehicle | null;
  offline: boolean;
  onClose: () => void;
}

/**
 * The one body for the desktop drawer and the mobile sheet. Both surfaces read
 * the same five states so their behaviour cannot drift apart.
 */
export function VehicleDetailBody({
  vehicleId,
  row,
  snapshotVehicle,
  offline,
  onClose,
}: VehicleDetailBodyProps) {
  const queryClient = useQueryClient();
  const vehicleQuery = useVehicle(vehicleId);
  const vehicle = vehicleQuery.data;
  const tripId = vehicle?.trip_id ?? snapshotVehicle?.trip_id;
  const tripQuery = useTrips({ limit: 500 }, { enabled: Boolean(tripId) });
  const trips = Array.isArray(tripQuery.data) ? tripQuery.data : undefined;
  const detailError = vehicleQuery.error && !offline ? normalize(vehicleQuery.error) : null;
  const notFound = detailError?.kind === "not_found";
  const forbidden = detailError?.kind === "forbidden";
  const view = useQueryView(vehicleQuery, { offline });
  const showDetailSkeleton = useDelayedFlag(view.state === "loading");

  function retryDetail(): void {
    void vehicleQuery.refetch();
  }

  if (notFound) {
    return (
      <div className="p-4">
        <p className="text-base font-medium text-text">Vehicle not found</p>
        <p className="mt-1 text-sm text-muted">It may have been removed.</p>
        <Button className="mt-4" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  if (forbidden) {
    return <ForbiddenState action={<Button onClick={onClose}>Close</Button>} />;
  }

  return (
    <>
      {row ? <VehicleCurrentState row={row} vehicle={vehicle} /> : null}

      {view.state === "loading" ? (
        <>
          <SlowNotice
            onRetry={retryDetail}
            onCancel={() =>
              void queryClient.cancelQueries({ queryKey: queryKeys.vehicle(vehicleId) })
            }
          />
          {showDetailSkeleton ? <VehicleDrawerSkeleton /> : null}
        </>
      ) : view.state === "offline-empty" ? (
        <EmptyState
          title="Vehicle details aren't available offline"
          description="Reconnect to load the full record."
        />
      ) : view.state === "error" || view.state === "empty" ? (
        detailError && !vehicle && !row ? (
          <div className="p-4">
            <ErrorState error={detailError} onRetry={retryDetail} />
          </div>
        ) : detailError && !vehicle ? (
          <div className="border-b border-border p-4">
            <ErrorState compact error={detailError} onRetry={retryDetail} />
            <p className="mt-2 text-xs text-muted">
              Live fields stay visible while the full record is unavailable.
            </p>
          </div>
        ) : (
          <EmptyState
            title="Vehicle details aren't available"
            description="Retry to load the full record."
            action={
              <Button size="sm" variant="secondary" onClick={retryDetail}>
                Retry
              </Button>
            }
          />
        )
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
  );
}

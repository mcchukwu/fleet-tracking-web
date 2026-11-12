import type { SnapshotVehicle, Trip } from "../../../api/types";
import { normalize } from "../../../errors/normalize";
import { ErrorState } from "../../../errors/ErrorState";
import { formatDistance, MISSING } from "../../../lib/format";
import { isTripStatus } from "../../../lib/status";
import { tripDistanceKm } from "../../../lib/trips";
import { useDelayedFlag } from "../../../lib/useDelayedFlag";
import { Skeleton } from "../../../ui/StatePanel";
import { Timestamp } from "../../../ui/Timestamp";
import { Badge, TripStatusBadge } from "../../../ui/Badge";
import { VehicleField, VehicleSection } from "./VehicleField";

export interface TripsResult {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

export interface VehicleTripSectionProps {
  tripId?: string;
  snapshotVehicle?: SnapshotVehicle | null;
  trips?: readonly Trip[];
  tripQuery: TripsResult;
  offline?: boolean;
}

export function VehicleTripSection({
  tripId,
  snapshotVehicle,
  trips,
  tripQuery,
  offline = false,
}: VehicleTripSectionProps) {
  const showSkeleton = useDelayedFlag(tripQuery.isLoading);
  const fallbackDestination = snapshotVehicle?.destination;
  const fallbackStatus = snapshotVehicle?.trip_status;

  if (!tripId) {
    if (!fallbackDestination && !fallbackStatus) {
      return (
        <VehicleSection title="Trip">
          <p className="text-sm text-muted">No active trip.</p>
        </VehicleSection>
      );
    }
    return (
      <VehicleSection title="Trip">
        <dl>
          <VehicleField label="Origin">{MISSING}</VehicleField>
          <VehicleField label="Destination">{fallbackDestination ?? MISSING}</VehicleField>
          <VehicleField label="Status">
            {isTripStatus(fallbackStatus) ? (
              <TripStatusBadge status={fallbackStatus} />
            ) : (
              (fallbackStatus ?? MISSING)
            )}
          </VehicleField>
        </dl>
        <p className="mt-1 text-xs text-muted">Origin isn't included in the live vehicle record.</p>
      </VehicleSection>
    );
  }

  const trip = trips?.find((item) => item.id === tripId);

  if (tripQuery.isLoading) {
    return (
      <VehicleSection title="Trip">
        {showSkeleton ? (
          <div className="space-y-2">
            <Skeleton className="w-1/3" />
            <Skeleton className="w-2/3" />
            <Skeleton className="w-1/2" />
          </div>
        ) : null}
      </VehicleSection>
    );
  }

  if (!trip && !trips && (offline || tripQuery.isError)) {
    if (offline) {
      return (
        <VehicleSection title="Trip">
          <p className="text-sm text-muted">Trip details need a connection.</p>
        </VehicleSection>
      );
    }
    return (
      <VehicleSection title="Trip">
        <ErrorState
          compact
          error={normalize(tripQuery.error)}
          onRetry={() => void tripQuery.refetch()}
        />
      </VehicleSection>
    );
  }

  if (!trip) {
    return (
      <VehicleSection title="Trip">
        <dl>
          <VehicleField label="Origin">{MISSING}</VehicleField>
          <VehicleField label="Destination">{fallbackDestination ?? MISSING}</VehicleField>
          <VehicleField label="Status">
            {isTripStatus(fallbackStatus) ? (
              <TripStatusBadge status={fallbackStatus} />
            ) : (
              (fallbackStatus ?? MISSING)
            )}
          </VehicleField>
        </dl>
        <p className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
          Trip details unavailable.
          {offline ? null : (
            <button
              type="button"
              onClick={() => void tripQuery.refetch()}
              className="h-touch rounded-sm px-2 font-medium text-accent-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus-ring md:h-control-sm"
            >
              Retry
            </button>
          )}
        </p>
      </VehicleSection>
    );
  }

  return (
    <VehicleSection title="Trip">
      <dl>
        <VehicleField label="Origin">{trip.origin}</VehicleField>
        <VehicleField label="Destination">{trip.destination}</VehicleField>
        <VehicleField label="Status">
          {isTripStatus(trip.status) ? (
            <TripStatusBadge status={trip.status} />
          ) : (
            <Badge tone="neutral">Unknown status: {trip.status}</Badge>
          )}
        </VehicleField>
        <VehicleField label="Started">
          {trip.started_at ? <Timestamp iso={trip.started_at} /> : MISSING}
        </VehicleField>
        <VehicleField label="Distance">{formatDistance(tripDistanceKm(trip))}</VehicleField>
      </dl>
      {tripQuery.isError && !offline ? (
        <p className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
          Couldn't refresh the trip.
          <button
            type="button"
            onClick={() => void tripQuery.refetch()}
            className="h-touch rounded-sm px-2 font-medium text-accent-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus-ring md:h-control-sm"
          >
            Retry
          </button>
        </p>
      ) : null}
    </VehicleSection>
  );
}

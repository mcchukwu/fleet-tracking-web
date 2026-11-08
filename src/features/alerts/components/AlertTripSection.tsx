import { useTrips } from "../../../api/hooks/trips";
import type { Trip } from "../../../api/types";
import { ErrorState } from "../../../errors/ErrorState";
import { normalize } from "../../../errors/normalize";
import { tripStatusLabels } from "../../../lib/status";
import { Badge, TripStatusBadge } from "../../../ui/Badge";
import { Skeleton } from "../../../ui/StatePanel";

const TRIP_STATUSES = new Set(Object.keys(tripStatusLabels));

export interface AlertTripSectionProps {
  tripId?: string;
}

export function AlertTripSection({ tripId }: AlertTripSectionProps) {
  const query = useTrips({ limit: 500 }, { enabled: Boolean(tripId) });

  if (!tripId) {
    return <p className="text-sm text-muted">No trip linked.</p>;
  }

  if (query.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading trip" className="flex flex-col gap-2">
        <Skeleton className="w-1/2" />
        <Skeleton className="w-2/3" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState compact error={normalize(query.error)} onRetry={() => void query.refetch()} />
    );
  }

  const trips = Array.isArray(query.data) ? query.data : [];
  const trip: Trip | undefined = trips.find((row) => row.id === tripId);
  if (!trip) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">Trip details unavailable.</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="h-touch rounded-sm px-2 text-xs font-medium text-accent-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus-ring md:h-control-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-3 gap-y-1 text-xs">
      <dt className="text-muted">Route</dt>
      <dd className="min-w-0 break-words text-text">
        {trip.origin} → {trip.destination}
      </dd>
      <dt className="text-muted">Status</dt>
      <dd>
        {TRIP_STATUSES.has(trip.status) ? (
          <TripStatusBadge status={trip.status} />
        ) : (
          <Badge tone="neutral">Unknown status: {trip.status}</Badge>
        )}
      </dd>
      <dt className="text-muted">Driver</dt>
      <dd className="text-text">{trip.driver_name ?? "—"}</dd>
    </dl>
  );
}

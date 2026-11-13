import { useTrips } from "../../../api/hooks/trips";
import type { Trip } from "../../../api/types";
import { ErrorState } from "../../../errors/ErrorState";
import { normalize } from "../../../errors/normalize";
import { isTripStatus } from "../../../lib/status";
import { Badge, TripStatusBadge } from "../../../ui/Badge";
import { Skeleton } from "../../../ui/StatePanel";

export interface AlertTripSectionProps {
  tripId?: string;
  offline?: boolean;
}

export function AlertTripSection({ tripId, offline = false }: AlertTripSectionProps) {
  const query = useTrips({ limit: 500 }, { enabled: Boolean(tripId) });

  if (!tripId) {
    return <p className="text-muted text-sm">No trip linked.</p>;
  }

  if (query.isLoading) {
    return (
      <div aria-busy="true" aria-label="Loading trip" className="flex flex-col gap-2">
        <Skeleton className="w-1/2" />
        <Skeleton className="w-2/3" />
      </div>
    );
  }

  if (offline && !query.data) {
    return <p className="text-muted text-sm">Trip details need a connection.</p>;
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
        <p className="text-muted text-sm">Trip details unavailable.</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="h-touch text-accent-fg hover:bg-surface-2 focus-visible:outline-focus-ring md:h-control-sm rounded-sm px-2 text-xs font-medium focus-visible:outline-2"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-3 gap-y-1 text-xs">
      <dt className="text-muted">Route</dt>
      <dd className="text-text min-w-0 break-words">
        {trip.origin} → {trip.destination}
      </dd>
      <dt className="text-muted">Status</dt>
      <dd>
        {isTripStatus(trip.status) ? (
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

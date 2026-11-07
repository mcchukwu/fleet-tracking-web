import { HelpCircle, LogIn, LogOut, MapPin, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { VehicleEvent } from "../../../api/types";
import { useVehicleEvents } from "../../../api/hooks/vehicles";
import { ErrorState } from "../../../errors/ErrorState";
import { normalize } from "../../../errors/normalize";
import { AlertStatusBadge, Badge, SeverityBadge } from "../../../ui/Badge";
import { useDelayedFlag } from "../../../lib/useDelayedFlag";
import { Skeleton } from "../../../ui/StatePanel";
import { Timestamp } from "../../../ui/Timestamp";
import { cn } from "../../../ui/cn";
import {
  eventLabel,
  eventWindowFrom,
  eventsCapLabel,
  isKnownAlertStatus,
  isKnownSeverity,
  recentEvents,
} from "../lib/events";
import { EvidenceList } from "./EvidenceList";
import { VehicleSection } from "./VehicleField";

export interface VehicleEventsSectionProps {
  vehicleId: string;
  offline?: boolean;
}

function EventIcon({ event }: { event: VehicleEvent }) {
  if (event.kind === "geofence") {
    if (event.type === "enter") {
      return <LogIn aria-hidden="true" className="size-4 text-moving-fg" strokeWidth={1.5} />;
    }
    if (event.type === "exit") {
      return <LogOut aria-hidden="true" className="size-4 text-idle-fg" strokeWidth={1.5} />;
    }
    return <MapPin aria-hidden="true" className="size-4 text-muted" strokeWidth={1.5} />;
  }
  if (event.kind === "alert") {
    return <TriangleAlert aria-hidden="true" className="size-4 text-alert-fg" strokeWidth={1.5} />;
  }
  return <HelpCircle aria-hidden="true" className="size-4 text-subtle" strokeWidth={1.5} />;
}

function EventRow({
  id,
  event,
  expanded,
  onToggle,
}: {
  id: string;
  event: VehicleEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasEvidence = event.evidence !== undefined && Object.keys(event.evidence).length > 0;
  const evidenceId = `${id}-evidence`;

  return (
    <li className="border-b border-border py-2 last:border-b-0">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          <EventIcon event={event} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 text-sm font-medium text-text">{eventLabel(event)}</p>
            {event.severity === undefined ? null : isKnownSeverity(event.severity) ? (
              <SeverityBadge level={event.severity} />
            ) : (
              <Badge tone="neutral">Unknown severity: {event.severity}</Badge>
            )}
            {event.status === undefined ? null : isKnownAlertStatus(event.status) ? (
              <AlertStatusBadge status={event.status} />
            ) : (
              <Badge tone="neutral">Unknown status: {event.status}</Badge>
            )}
          </div>
          {event.name ? <p className="truncate text-xs text-muted">{event.name}</p> : null}
          <div className="mt-0.5 flex items-center gap-2">
            <Timestamp iso={event.at} className="text-xs text-muted" />
            {hasEvidence ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={evidenceId}
                onClick={onToggle}
                className="h-touch rounded-sm px-2 text-xs font-medium text-accent-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus-ring md:h-control-sm"
              >
                {expanded ? "Hide evidence" : "Show evidence"}
              </button>
            ) : null}
          </div>
          {hasEvidence && expanded ? (
            <div id={evidenceId} className="mt-2 rounded-sm bg-surface-2 p-2">
              <EvidenceList evidence={event.evidence ?? {}} />
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function VehicleEventsSection({ vehicleId, offline = false }: VehicleEventsSectionProps) {
  const [from] = useState(() => eventWindowFrom(Date.now()));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const query = useVehicleEvents(vehicleId, { from }, { refetchInterval: 60_000 });
  const events = query.data ? recentEvents(query.data) : [];
  const capLabel = query.data ? eventsCapLabel(query.data.length) : null;
  const showSkeleton = useDelayedFlag(query.isPending);

  function toggle(id: string): void {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <VehicleSection title="Recent events">
      {query.isPending ? (
        showSkeleton ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="w-1/2" />
            <Skeleton className="w-2/3" />
            <Skeleton className="w-1/3" />
          </div>
        ) : null
      ) : query.isError && !query.data ? (
        offline ? (
          <p className="text-sm text-muted">Events need a connection.</p>
        ) : (
          <ErrorState
            compact
            error={normalize(query.error)}
            onRetry={() => void query.refetch()}
          />
        )
      ) : (
        <>
          {query.isError && query.data && !offline ? (
            <div className={cn("mb-2 flex items-center justify-between gap-2 text-xs text-muted")}>
              <span>Couldn't refresh events.</span>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="h-touch rounded-sm px-2 font-medium text-accent-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus-ring md:h-control-sm"
              >
                Retry
              </button>
            </div>
          ) : null}
          {events.length === 0 ? (
            <p className="text-sm text-muted">No events in the last 24 hours.</p>
          ) : (
            <ul>
              {events.map((event, index) => {
                const id = `${event.kind}:${event.type}:${event.at}:${index}`;
                return (
                  <EventRow
                    key={id}
                    id={id}
                    event={event}
                    expanded={expanded.has(id)}
                    onToggle={() => toggle(id)}
                  />
                );
              })}
            </ul>
          )}
          {capLabel ? <p className="mt-2 text-xs text-muted">{capLabel}</p> : null}
        </>
      )}
    </VehicleSection>
  );
}

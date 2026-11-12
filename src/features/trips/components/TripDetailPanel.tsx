import { MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Trip } from "../../../api/types";
import { ErrorState } from "../../../errors/ErrorState";
import { InlineError } from "../../../errors/InlineError";
import type { AppError } from "../../../errors/types";
import { MISSING, formatDistance } from "../../../lib/format";
import { isTripStatus, tripStatusLabel } from "../../../lib/status";
import {
  canCancelTrip,
  nextTripAction,
  tripDistanceKm,
  type TripAction,
} from "../../../lib/trips";
import { Badge, TripStatusBadge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { CopyButton } from "../../../ui/CopyButton";
import { Drawer } from "../../../ui/Drawer";
import { Skeleton } from "../../../ui/StatePanel";
import { Timestamp } from "../../../ui/Timestamp";

export type TripLookupState = "loading" | "ready" | "not-found" | "error" | "offline";

export interface TripActionErrorState {
  error: AppError;
  title: string;
  detail: string;
  onRetry?: () => void;
}

export interface TripDetailPanelProps {
  trip: Trip | null;
  lookup: TripLookupState;
  lookupError?: AppError | null;
  offline?: boolean;
  pending: boolean;
  disabledReason?: string;
  actionError?: TripActionErrorState | null;
  onAction: (action: TripAction) => void;
  onRetryLookup: () => void;
  onClose: () => void;
  returnFocus?: () => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-muted shrink-0 text-xs">{label}</dt>
      <dd className="text-text min-w-0 text-right text-sm">{children}</dd>
    </div>
  );
}

function TimelineRow({
  label,
  iso,
  accent = false,
}: {
  label: string;
  iso?: string;
  accent?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 py-1">
      <span
        aria-hidden="true"
        className={
          iso
            ? accent
              ? "bg-accent size-2 rounded-full"
              : "bg-border-strong size-2 rounded-full"
            : "border-border-strong size-2 rounded-full border"
        }
      />
      <span className="text-muted w-16 text-xs">{label}</span>
      {iso ? (
        <Timestamp iso={iso} className="text-xs" />
      ) : (
        <span className="text-muted text-xs">{MISSING}</span>
      )}
    </li>
  );
}

export function TripDetailPanel(props: TripDetailPanelProps) {
  if (!props.trip) return <MissingTripPanel {...props} />;
  return <ResolvedTripDetail {...props} trip={props.trip} />;
}

function MissingTripPanel({
  lookup,
  lookupError,
  onClose,
  onRetryLookup,
  returnFocus,
}: TripDetailPanelProps) {
  return (
    <Drawer
      open
      placement="page"
      label="Trip details"
      title="Trip"
      closeLabel="Close trip details"
      onClose={onClose}
      returnFocus={returnFocus}
    >
      {lookup === "loading" ? (
        <div aria-busy="true" aria-label="Loading trip" className="space-y-3 p-4">
          <Skeleton className="w-2/3" />
          <Skeleton className="w-1/2" />
          <Skeleton className="w-full" />
        </div>
      ) : lookup === "error" && lookupError ? (
        <ErrorState error={lookupError} onRetry={onRetryLookup} className="py-8" />
      ) : lookup === "offline" ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <p className="text-text text-base font-medium">Trip isn't available offline</p>
          <p className="text-muted text-sm">Reconnect to load this trip.</p>
          <Button size="sm" onClick={onClose}>
            Back to trips
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <p className="text-text text-base font-medium">Trip not found</p>
          <p className="text-muted text-sm">It may be older than the first 500 trips.</p>
          <Button size="sm" onClick={onClose}>
            Back to trips
          </Button>
        </div>
      )}
    </Drawer>
  );
}

function ResolvedTripDetail({
  trip,
  offline = false,
  pending,
  disabledReason,
  actionError,
  onAction,
  onClose,
  returnFocus,
}: TripDetailPanelProps & { trip: Trip }) {
  const navigate = useNavigate();
  const next = nextTripAction(trip);
  const cancellable = canCancelTrip(trip);
  const reason = pending ? undefined : disabledReason;

  return (
    <Drawer
      open
      placement="page"
      label="Trip details"
      title={trip.plate}
      closeLabel="Close trip details"
      headerAside={
        isTripStatus(trip.status) ? (
          <TripStatusBadge status={trip.status} />
        ) : (
          <Badge tone="neutral">Unknown status: {trip.status}</Badge>
        )
      }
      actions={
        <>
          {next ? (
            <Button
              size="sm"
              variant="secondary"
              loading={pending}
              {...(reason ? { disabledReason: reason } : {})}
              data-detail-action
              onClick={() => onAction(next.action)}
            >
              {next.label}
            </Button>
          ) : null}
          {cancellable ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:bg-alert-bg"
              disabled={pending}
              {...(reason ? { disabledReason: reason } : {})}
              data-detail-action
              onClick={() => onAction("cancel")}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<MapPin aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />}
            onClick={() => void navigate({ to: "/map", search: { v: trip.vehicle_id } })}
          >
            View on map
          </Button>
        </>
      }
      onClose={onClose}
      returnFocus={returnFocus}
    >
      <div className="flex flex-col gap-4 p-4">
        {actionError ? (
          <InlineError
            error={actionError.error}
            copy={{ title: actionError.title, detail: actionError.detail }}
            {...(actionError.onRetry ? { onRetry: actionError.onRetry } : {})}
          />
        ) : null}

        {offline ? (
          <p className="text-muted text-xs">
            Showing the last loaded details. Changes are disabled until you're back online.
          </p>
        ) : null}

        <section aria-labelledby="trip-route-heading">
          <h3 id="trip-route-heading" className="text-text mb-1 text-sm font-medium">
            Route
          </h3>
          <dl>
            <Field label="Origin">{trip.origin}</Field>
            <Field label="Destination">{trip.destination}</Field>
            <Field label="Status">{tripStatusLabel(trip.status)}</Field>
            <Field label="Distance">
              <span className="tabular-nums">{formatDistance(tripDistanceKm(trip))}</span>
            </Field>
          </dl>
        </section>

        <section aria-labelledby="trip-timeline-heading">
          <h3 id="trip-timeline-heading" className="text-text mb-1 text-sm font-medium">
            Timeline
          </h3>
          <ol className="border-border border-l pl-3">
            <TimelineRow label="Started" {...(trip.started_at ? { iso: trip.started_at } : {})} accent />
            <TimelineRow label="Ended" {...(trip.ended_at ? { iso: trip.ended_at } : {})} />
          </ol>
          <p className="text-muted mt-1 text-xs">
            The API records only the start and end times.
          </p>
        </section>

        <section aria-labelledby="trip-vehicle-heading">
          <h3 id="trip-vehicle-heading" className="text-text mb-1 text-sm font-medium">
            Vehicle
          </h3>
          <dl>
            <Field label="Plate">
              <CopyButton inline value={trip.plate} label="plate" className="text-xs" />
            </Field>
            <Field label="Vehicle id">
              <CopyButton
                inline
                value={trip.vehicle_id}
                label="vehicle id"
                className="text-xs break-all"
              />
            </Field>
            <Field label="Trip id">
              <CopyButton
                inline
                value={trip.id}
                label="trip id"
                className="text-xs break-all"
              />
            </Field>
          </dl>
        </section>

        <section aria-labelledby="trip-driver-heading">
          <h3 id="trip-driver-heading" className="text-text mb-1 text-sm font-medium">
            Driver
          </h3>
          <dl>
            <Field label="Name">{trip.driver_name ?? MISSING}</Field>
            <Field label="Driver id">
              {trip.driver_id ? (
                <CopyButton
                  inline
                  value={trip.driver_id}
                  label="driver id"
                  className="text-xs break-all"
                />
              ) : (
                MISSING
              )}
            </Field>
          </dl>
        </section>
      </div>
    </Drawer>
  );
}

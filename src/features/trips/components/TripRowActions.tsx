import type { Trip } from "../../../api/types";
import { canCancelTrip, nextTripAction, type TripAction } from "../../../lib/trips";
import { Button } from "../../../ui/Button";

export interface TripRowActionsProps {
  trip: Trip;
  pending: boolean;
  disabledReason?: string;
  onAction: (action: TripAction) => void;
}

/** The next action and Cancel stay visible; they are never hover-only. */
export function TripRowActions({
  trip,
  pending,
  disabledReason,
  onAction,
}: TripRowActionsProps) {
  const next = nextTripAction(trip);
  const cancellable = canCancelTrip(trip);
  if (!next && !cancellable) return null;

  const reason = pending ? undefined : disabledReason;

  return (
    <div className="flex items-center justify-end gap-1">
      {next ? (
        <Button
          size="sm"
          variant="secondary"
          className="-my-1.5 md:my-0"
          loading={pending}
          {...(reason ? { disabledReason: reason } : {})}
          onClick={() => onAction(next.action)}
          aria-label={`${next.label} ${trip.plate}`}
        >
          {next.label}
        </Button>
      ) : null}
      {cancellable ? (
        <Button
          size="sm"
          variant="ghost"
          className="-my-1.5 text-danger hover:bg-alert-bg disabled:opacity-50 md:my-0"
          disabled={pending}
          {...(reason ? { disabledReason: reason } : {})}
          onClick={() => onAction("cancel")}
          aria-label={`Cancel trip for ${trip.plate}`}
        >
          Cancel
        </Button>
      ) : null}
    </div>
  );
}

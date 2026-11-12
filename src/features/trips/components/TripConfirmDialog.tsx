import { useEffect, useRef } from "react";
import type { Trip } from "../../../api/types";
import { InlineError } from "../../../errors/InlineError";
import { SlowNotice } from "../../../errors/SlowNotice";
import { transitionPayload, type TripAction } from "../../../lib/trips";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { tripWriteCopy, useTripWrite } from "../hooks/useTripWrite";

export interface TripConfirmDialogProps {
  open: boolean;
  trip: Trip | null;
  action: Extract<TripAction, "complete" | "cancel">;
  onClose: () => void;
  onFinished?: () => void;
  disabledReason?: string;
}

export function TripConfirmDialog({
  open,
  trip,
  action,
  onClose,
  onFinished,
  disabledReason,
}: TripConfirmDialogProps) {
  const write = useTripWrite();
  const { reset } = write;
  const errorRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => cancelRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (write.error) errorRef.current?.focus();
  }, [write.error]);

  async function submit(): Promise<void> {
    if (!trip || write.pending || disabledReason) return;
    const outcome = await write.transition(trip, transitionPayload(action), action);
    if (outcome.status === "done" || outcome.status === "gone" || outcome.status === "conflict") {
      onFinished?.();
      onClose();
    }
  }

  const completing = action === "complete";
  const copy = write.error ? tripWriteCopy(write.error, "change") : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !write.pending) onClose();
      }}
      title={completing ? "Complete trip" : "Cancel trip"}
      description={
        trip
          ? completing
            ? `Complete the trip to ${trip.destination} for ${trip.plate}? The server stores the distance.`
            : `Cancel the trip to ${trip.destination} for ${trip.plate}? This can't be undone.`
          : undefined
      }
      footer={
        <>
          <Button ref={cancelRef} onClick={onClose} disabled={write.pending}>
            Keep trip
          </Button>
          <Button
            variant={completing ? "primary" : "destructive"}
            onClick={() => void submit()}
            loading={write.pending}
            {...(disabledReason ? { disabledReason } : {})}
          >
            {completing ? "Complete trip" : "Cancel trip"}
          </Button>
        </>
      }
    >
      {write.pending ? <SlowNotice /> : null}

      <div ref={errorRef} tabIndex={-1} className="focus:outline-none">
        {write.error && copy ? (
          <InlineError
            error={write.error}
            copy={copy}
            {...(write.error.kind === "not_found" || write.error.kind === "conflict"
              ? {
                  onRetry: () => {
                    onFinished?.();
                    onClose();
                  },
                }
              : {})}
          />
        ) : null}
      </div>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { useDrivers } from "../../../api/hooks/drivers";
import type { Trip } from "../../../api/types";
import { InlineError } from "../../../errors/InlineError";
import { SlowNotice } from "../../../errors/SlowNotice";
import { activeDrivers, driverDescription } from "../../../lib/drivers";
import { transitionPayload } from "../../../lib/trips";
import { Button } from "../../../ui/Button";
import { Combobox } from "../../../ui/Combobox";
import { Dialog } from "../../../ui/Dialog";
import { tripWriteCopy, useTripWrite } from "../hooks/useTripWrite";

export interface TripAssignDriverDialogProps {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  onFinished?: () => void;
  disabledReason?: string;
}

export function TripAssignDriverDialog({
  open,
  trip,
  onClose,
  onFinished,
  disabledReason,
}: TripAssignDriverDialogProps) {
  const driversQuery = useDrivers();
  const write = useTripWrite();
  const { reset: resetWrite } = write;
  const [driverId, setDriverId] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => cancelRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (write.error) errorRef.current?.focus();
  }, [write.error]);

  const drivers = activeDrivers(driversQuery.data ?? []);
  const items = drivers.map((driver) => ({
    id: driver.id,
    label: driver.name,
    description: driverDescription(driver),
  }));

  function close(): void {
    setDriverId(null);
    resetWrite();
    onClose();
  }

  async function submit(): Promise<void> {
    if (!trip || !driverId || write.pending || disabledReason) return;
    const outcome = await write.transition(trip, transitionPayload("assign", driverId), "assign");
    if (outcome.status === "done" || outcome.status === "gone" || outcome.status === "conflict") {
      onFinished?.();
      close();
    }
  }

  const copy = write.error ? tripWriteCopy(write.error, "change") : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !write.pending) close();
      }}
      title={trip ? `Assign a driver to ${trip.plate}` : "Assign a driver"}
      description="Choose an active driver, then assign the trip."
      footer={
        <>
          <Button ref={cancelRef} onClick={close} disabled={write.pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            loading={write.pending}
            disabled={!driverId}
            {...(disabledReason ? { disabledReason } : {})}
          >
            Assign driver
          </Button>
        </>
      }
    >
      {write.pending ? <SlowNotice /> : null}

      <div ref={errorRef} tabIndex={-1} className="focus:outline-none">
        {write.error && copy ? (
          <div className="mb-3">
            <InlineError error={write.error} copy={copy} />
          </div>
        ) : null}
      </div>

      {!driversQuery.isLoading && !driversQuery.error && drivers.length === 0 ? (
        <p className="text-muted mb-3 text-sm">
          No active drivers are available. Add one before assigning this trip.
        </p>
      ) : null}

      <Combobox
        label="Driver"
        items={items}
        value={driverId}
        onChange={setDriverId}
        loading={driversQuery.isLoading}
        error={driversQuery.error ? "Couldn't load drivers." : undefined}
        onRetry={() => void driversQuery.refetch()}
        emptyMessage="No active drivers"
        placeholder="Search by name, phone or licence"
      />
    </Dialog>
  );
}

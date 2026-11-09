import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useDrivers } from "../../../api/hooks/drivers";
import { useLiveSnapshot } from "../../../api/hooks/vehicles";
import { InlineError } from "../../../errors/InlineError";
import { SlowNotice } from "../../../errors/SlowNotice";
import { activeDrivers, driverDescription } from "../../../lib/drivers";
import { Button } from "../../../ui/Button";
import { Combobox } from "../../../ui/Combobox";
import { Dialog } from "../../../ui/Dialog";
import { Input } from "../../../ui/Input";
import {
  createTripFormSchema,
  emptyTripForm,
  toTripInput,
  type TripFormValues,
} from "../lib/form";
import { tripWriteCopy, useTripWrite } from "../hooks/useTripWrite";

export interface TripCreateDialogProps {
  open: boolean;
  knownTripIds: ReadonlySet<string>;
  onCreated: () => void;
  onClose: () => void;
}

export function TripCreateDialog({
  open,
  knownTripIds,
  onCreated,
  onClose,
}: TripCreateDialogProps) {
  const snapshot = useLiveSnapshot(open);
  const driversQuery = useDrivers();
  const write = useTripWrite();
  const { reset: resetWrite } = write;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<TripFormValues>({
    resolver: zodResolver(createTripFormSchema),
    mode: "onBlur",
    defaultValues: emptyTripForm,
  });

  const vehicleId = useWatch({ control, name: "vehicle_id" });
  const driverId = useWatch({ control, name: "driver_id" });

  useEffect(() => {
    if (!open) {
      reset(emptyTripForm);
      resetWrite();
    }
  }, [open, reset, resetWrite]);

  useEffect(() => {
    if (!isDirty || !open) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, open]);

  useEffect(() => {
    if (write.error) errorRef.current?.focus();
  }, [write.error]);

  function requestClose(): void {
    if (write.pending) return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  async function onSubmit(values: TripFormValues): Promise<void> {
    const outcome = await write.create(toTripInput(values), knownTripIds);
    if (outcome.status === "created" || outcome.status === "reconciled") {
      reset(emptyTripForm);
      onCreated();
      onClose();
    }
  }

  const vehicleItems = (snapshot.data ?? []).map((vehicle) => ({
    id: vehicle.id,
    label: vehicle.plate,
    description: [vehicle.depot, vehicle.external_id].filter(Boolean).join(" · "),
    labelClassName: "font-mono",
  }));
  const driverItems = activeDrivers(driversQuery.data ?? []).map((driver) => ({
    id: driver.id,
    label: driver.name,
    description: driverDescription(driver),
  }));
  const copy = write.error ? tripWriteCopy(write.error, "create") : null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
        title="Create trip"
        description="The trip starts as planned. Assign a driver and start it from the table."
        footer={
          <>
            <Button onClick={requestClose} disabled={write.pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="trip-create-form"
              variant="primary"
              loading={write.pending}
            >
              Create trip
            </Button>
          </>
        }
      >
        <form
          id="trip-create-form"
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        >
          {write.pending ? <SlowNotice /> : null}

          <div ref={errorRef} tabIndex={-1} className="focus:outline-none">
            {write.error && copy ? (
              <div className="mb-3">
                <InlineError error={write.error} copy={copy} />
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Combobox
              className="sm:col-span-2"
              label="Vehicle"
              items={vehicleItems}
              value={vehicleId || null}
              onChange={(id) => setValue("vehicle_id", id, { shouldDirty: true, shouldValidate: true })}
              loading={snapshot.isPending}
              error={snapshot.error ? "Couldn't load vehicles. Try again." : undefined}
              emptyMessage="No vehicles"
              placeholder="Search by plate, depot or IMEI"
            />
            {errors.vehicle_id?.message ? (
              <p className="text-danger text-xs sm:col-span-2" role="alert">
                {errors.vehicle_id.message}
              </p>
            ) : null}

            <Combobox
              className="sm:col-span-2"
              label="Driver (optional)"
              items={driverItems}
              value={driverId || null}
              onChange={(id) => setValue("driver_id", id, { shouldDirty: true })}
              loading={driversQuery.isPending}
              error={driversQuery.error ? "Couldn't load drivers. The trip can still be created." : undefined}
              emptyMessage="No active drivers"
              placeholder="Search by name, phone or licence"
            />

            <Input
              label="Origin"
              placeholder="Refinery Gate"
              error={errors.origin?.message}
              {...register("origin")}
            />
            <Input
              label="Destination"
              placeholder="Ibadan Customer"
              error={errors.destination?.message}
              {...register("destination")}
            />
          </div>
        </form>
      </Dialog>

      <Dialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this trip?"
        description="The details you entered will be lost."
        footer={
          <>
            <Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDiscard(false);
                reset(emptyTripForm);
                onClose();
              }}
            >
              Discard
            </Button>
          </>
        }
      />
    </>
  );
}

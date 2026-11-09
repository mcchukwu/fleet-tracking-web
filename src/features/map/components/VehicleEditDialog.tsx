import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { Vehicle } from "../../../api/types";
import { useDrivers } from "../../../api/hooks/drivers";
import { InlineError } from "../../../errors/InlineError";
import { SlowNotice } from "../../../errors/SlowNotice";
import { errorCopy } from "../../../errors/catalog";
import { Button } from "../../../ui/Button";
import { Combobox } from "../../../ui/Combobox";
import { Dialog } from "../../../ui/Dialog";
import { Input } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import { activeDrivers, driverDescription } from "../../../lib/drivers";
import {
  administrativeStatuses,
  createVehicleFormSchema,
  diffVehicle,
  toVehicleFormValues,
  type VehicleFormValues,
} from "../lib/vehicleForm";
import { useVehicleWrite } from "../hooks/useVehicleWrite";

export interface VehicleEditDialogProps {
  open: boolean;
  vehicle: Vehicle;
  onClose: () => void;
  onSaved: () => void;
  onRefresh: () => void;
  readOnly: boolean;
}

export function VehicleEditDialog({
  open,
  vehicle,
  onClose,
  onSaved,
  onRefresh,
  readOnly,
}: VehicleEditDialogProps) {
  const driversQuery = useDrivers();
  const write = useVehicleWrite(vehicle.id);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(createVehicleFormSchema(vehicle)),
    mode: "onBlur",
    values: toVehicleFormValues(vehicle),
  });

  const driverId = useWatch({ control, name: "driver_id" });
  const watchedValues = useWatch({ control });
  const noChanges = Object.keys(diffVehicle(vehicle, watchedValues)).length === 0;

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

  async function onSubmit(next: VehicleFormValues): Promise<void> {
    const update = diffVehicle(vehicle, next);
    if (Object.keys(update).length === 0) return;
    const outcome = await write.submit(update);
    if (outcome.status === "success" || outcome.status === "reconciled") {
      reset(toVehicleFormValues(vehicle));
      onSaved();
      onClose();
    }
  }

  const driverItems = activeDrivers(driversQuery.data ?? []).map((driver) => ({
    id: driver.id,
    label: driver.name,
    description: driverDescription(driver),
  }));
  const driverValue = !driverId ? null : driverId;
  const copy = write.error
    ? write.error.kind === "validation"
      ? { title: "Couldn't save the vehicle", detail: "Check the fields and try again." }
      : write.error.kind === "conflict" || write.error.kind === "not_found"
        ? { title: errorCopy(write.error).title, detail: errorCopy(write.error).detail }
        : (write.error.kind === "network" || write.error.kind === "timeout") &&
            write.error.outcome === "failed"
          ? { title: "It wasn't saved.", detail: "Try again." }
          : undefined
    : undefined;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
        title={`Edit ${vehicle.plate}`}
        description="Administrative status is separate from the live map status."
        footer={
          <>
            <Button onClick={requestClose} disabled={write.pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="vehicle-edit-form"
              variant="primary"
              loading={write.pending}
              disabled={noChanges || readOnly}
            >
              Save changes
            </Button>
          </>
        }
      >
        <form id="vehicle-edit-form" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          {write.pending ? <SlowNotice /> : null}

          <div ref={errorRef} tabIndex={-1} className="focus:outline-none">
            {write.error ? (
              <div className="mb-3 space-y-2">
                <InlineError error={write.error} copy={copy} />
                {write.error.kind === "conflict" || write.error.kind === "not_found" ? (
                  <Button size="sm" onClick={onRefresh}>
                    Refresh
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {readOnly ? (
            <p className="mb-3 text-sm text-muted">
              Your role can't edit vehicles. The fields are shown for reference.
            </p>
          ) : null}

          <div className="grid max-h-96 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            <Input
              label="Plate"
              error={errors.plate?.message}
              disabled={readOnly}
              {...register("plate")}
            />
            <Select
              label="Administrative status"
              hint="Not the live map status."
              error={errors.status?.message}
              disabled={readOnly}
              {...register("status")}
            >
              <option value="">Choose a status</option>
              {administrativeStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </Select>

            <Combobox
              className="sm:col-span-2"
              label="Driver"
              items={driverItems}
              value={driverValue}
              selectedLabel={vehicle.driver_name ?? "No driver assigned"}
              onChange={(id) => setValue("driver_id", id, { shouldDirty: true })}
              loading={driversQuery.isPending}
              error={driversQuery.error ? "Couldn't load drivers." : undefined}
              emptyMessage="No active drivers"
              disabled={readOnly}
              disabledReason={readOnly ? "Your role can't edit vehicles." : undefined}
            />

            <Input label="Vehicle type" disabled={readOnly} {...register("vehicle_type")} />
            <Input label="Make" disabled={readOnly} {...register("make")} />
            <Input label="Model" disabled={readOnly} {...register("model")} />
            <Input
              label="Year"
              inputMode="numeric"
              error={errors.year?.message}
              disabled={readOnly}
              {...register("year")}
            />
            <Input label="Colour" disabled={readOnly} {...register("colour")} />
            <Input label="Depot" disabled={readOnly} {...register("depot")} />
            <Input label="Department" disabled={readOnly} {...register("department")} />

            <fieldset className="m-0 border-0 p-0 sm:col-span-2">
              <legend className="label-caps mb-2 text-muted">Device (write-only)</legend>
              <p className="mb-2 text-xs text-muted">
                The API accepts these fields but doesn't return them.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input label="SIM number" disabled={readOnly} {...register("sim_number")} />
                <Input label="Device model" disabled={readOnly} {...register("device_model")} />
                <Input label="Protocol" disabled={readOnly} {...register("protocol")} />
              </div>
            </fieldset>
          </div>

          <output className="mt-3 block text-xs text-muted">
            {noChanges ? "No changes to save." : "Only changed fields are sent."}
          </output>
        </form>
      </Dialog>

      <Dialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard changes?"
        description="Your edits to this vehicle will be lost."
        footer={
          <>
            <Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDiscard(false);
                reset(toVehicleFormValues(vehicle));
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

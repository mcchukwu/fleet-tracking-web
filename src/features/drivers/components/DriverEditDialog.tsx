import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { Driver, DriverUpdate } from "../../../api/types";
import { InlineError } from "../../../errors/InlineError";
import { SlowNotice } from "../../../errors/SlowNotice";
import { driverStatusLabels, driverStatusOptions } from "../../../lib/drivers";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { Input } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import {
  diffDriver,
  driverEditFormSchema,
  emptyDriverEditForm,
  hasChanges,
  requiresDeactivationConfirmation,
  toDriverEditFormValues,
  type DriverEditFormValues,
} from "../lib/form";
import { driverWriteCopy } from "../lib/reconcile";
import { useDriverWrite } from "../hooks/useDriverWrite";
import { DriverDeactivateDialog } from "./DriverDeactivateDialog";

export interface DriverEditDialogProps {
  open: boolean;
  driver: Driver | null;
  disabledReason?: string;
  onSaved: () => void;
  onClose: () => void;
  onRefresh: () => void;
}

export function DriverEditDialog({
  open,
  driver,
  disabledReason,
  onSaved,
  onClose,
  onRefresh,
}: DriverEditDialogProps) {
  "use no memo";
  const write = useDriverWrite();
  const { reset: resetWrite } = write;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<DriverUpdate | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<DriverEditFormValues>({
    resolver: zodResolver(driverEditFormSchema),
    mode: "onBlur",
    defaultValues: driver ? toDriverEditFormValues(driver) : emptyDriverEditForm,
  });

  useEffect(() => {
    if (!open || !driver) return;
    reset(toDriverEditFormValues(driver));
    resetWrite();
  }, [open, driver, reset, resetWrite]);

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

  async function save(update: DriverUpdate): Promise<void> {
    if (!driver) return;
    const outcome = await write.update(driver, update);
    if (outcome.status === "done") {
      onSaved();
      onClose();
    }
  }

  async function onSubmit(formValues: DriverEditFormValues): Promise<void> {
    if (!driver) return;
    const update = diffDriver(driver, formValues);
    if (!hasChanges(update)) return;
    if (requiresDeactivationConfirmation(driver, update)) {
      setPendingUpdate(update);
      return;
    }
    await save(update);
  }

  const copy = write.error ? driverWriteCopy(write.error, "update") : null;
  const changed = isDirty;

  return (
    <>
      <Dialog
        open={open && driver !== null}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
        title="Edit driver"
        description="Only changed fields are sent."
        footer={
          <>
            <Button onClick={requestClose} disabled={write.pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="driver-edit-form"
              variant="primary"
              loading={write.pending}
              disabled={!changed}
              {...(disabledReason ? { disabledReason } : {})}
            >
              Save changes
            </Button>
          </>
        }
      >
        <form
          id="driver-edit-form"
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        >
          {write.pending ? <SlowNotice /> : null}

          <div ref={errorRef} tabIndex={-1} className="focus:outline-none">
            {write.error && copy ? (
              <div className="mb-3">
                <InlineError error={write.error} copy={copy} />
                {write.error.kind === "not_found" ? (
                  <div className="mt-2">
                    <Button size="sm" onClick={onRefresh}>
                      Refresh
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3">
            <Input label="Name" autoComplete="name" error={errors.name?.message} {...register("name")} />
            <Input
              label="Phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              hint="Digits, spaces and a plus sign. At least seven digits."
              error={errors.phone?.message}
              {...register("phone")}
            />
            <Input label="Licence" error={errors.licence?.message} {...register("licence")} />
            <Select label="Status" error={errors.status?.message} {...register("status")}>
              {driver && driver.status !== "active" && driver.status !== "inactive" ? (
                <option value={driver.status}>Unknown status: {driver.status}</option>
              ) : null}
              {driverStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {driverStatusLabels[status]}
                </option>
              ))}
            </Select>
            <p className="text-muted text-xs" role={changed ? undefined : "status"}>
              {changed ? "Only the fields you changed will be sent." : "No changes to save."}
            </p>
          </div>
        </form>
      </Dialog>

      <DriverDeactivateDialog
        open={pendingUpdate !== null}
        driver={driver}
        update={pendingUpdate ?? {}}
        onCancel={() => {
          setPendingUpdate(null);
          setConfirmDiscard(false);
        }}
        onFinished={() => {
          setPendingUpdate(null);
          onSaved();
          onClose();
        }}
      />

      <Dialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard these changes?"
        description="The changes you made will be lost."
        footer={
          <>
            <Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDiscard(false);
                if (driver) reset(toDriverEditFormValues(driver));
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

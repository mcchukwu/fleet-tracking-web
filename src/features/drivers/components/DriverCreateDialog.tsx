import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { InlineError } from "../../../errors/InlineError";
import { SlowNotice } from "../../../errors/SlowNotice";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { Input } from "../../../ui/Input";
import {
  driverCreateFormSchema,
  emptyDriverCreateForm,
  toDriverInput,
  type DriverCreateFormValues,
} from "../lib/form";
import { driverWriteCopy } from "../lib/reconcile";
import { useDriverWrite } from "../hooks/useDriverWrite";

export interface DriverCreateDialogProps {
  open: boolean;
  knownDriverIds: ReadonlySet<string>;
  disabledReason?: string;
  onCreated: () => void;
  onClose: () => void;
}

export function DriverCreateDialog({
  open,
  knownDriverIds,
  disabledReason,
  onCreated,
  onClose,
}: DriverCreateDialogProps) {
  "use no memo";
  const write = useDriverWrite();
  const { reset: resetWrite } = write;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<DriverCreateFormValues>({
    resolver: zodResolver(driverCreateFormSchema),
    mode: "onBlur",
    defaultValues: emptyDriverCreateForm,
  });

  useEffect(() => {
    if (!open) {
      reset(emptyDriverCreateForm);
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

  async function onSubmit(values: DriverCreateFormValues): Promise<void> {
    if (disabledReason) return;
    const outcome = await write.create(toDriverInput(values), knownDriverIds);
    if (outcome.status === "created" || outcome.status === "reconciled") {
      reset(emptyDriverCreateForm);
      onCreated();
      onClose();
    }
  }

  const copy = write.error ? driverWriteCopy(write.error, "create") : null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
        title="Create driver"
        description="Name is required. Phone and licence are optional."
        footer={
          <>
            <Button onClick={requestClose} disabled={write.pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="driver-create-form"
              variant="primary"
              loading={write.pending}
              {...(disabledReason ? { disabledReason } : {})}
            >
              Create driver
            </Button>
          </>
        }
      >
        <form
          id="driver-create-form"
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        >
          {write.pending ? <SlowNotice onCancel={write.cancel} onRetry={write.retry} /> : null}

          <div ref={errorRef} tabIndex={-1} className="focus:outline-none">
            {write.error && copy ? (
              <div className="mb-3">
                <InlineError error={write.error} copy={copy} />
              </div>
            ) : null}
          </div>

          <div className="grid gap-3">
            <Input
              label="Name"
              autoComplete="name"
              error={errors.name?.message}
              {...register("name")}
            />
            <Input
              label="Phone (optional)"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              error={errors.phone?.message}
              hint="Digits, spaces and a plus sign. At least seven digits."
              {...register("phone")}
            />
            <Input
              label="Licence (optional)"
              error={errors.licence?.message}
              {...register("licence")}
            />
          </div>
        </form>
      </Dialog>

      <Dialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this driver?"
        description="The details you entered will be lost."
        footer={
          <>
            <Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDiscard(false);
                reset(emptyDriverCreateForm);
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

import { useEffect, useRef } from "react";
import type { Driver, DriverUpdate } from "../../../api/types";
import { InlineError } from "../../../errors/InlineError";
import { SlowNotice } from "../../../errors/SlowNotice";
import { formatCount } from "../../../lib/format";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { driverWriteCopy } from "../lib/reconcile";
import { useDriverWrite } from "../hooks/useDriverWrite";

export interface DriverDeactivateDialogProps {
  open: boolean;
  driver: Driver | null;
  update: DriverUpdate;
  onCancel: () => void;
  onFinished: () => void;
}

export function DriverDeactivateDialog({
  open,
  driver,
  update,
  onCancel,
  onFinished,
}: DriverDeactivateDialogProps) {
  const write = useDriverWrite();
  const { reset } = write;
  const keepActiveRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => keepActiveRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (write.error) errorRef.current?.focus();
  }, [write.error]);

  async function confirm(): Promise<void> {
    if (!driver || write.pending) return;
    const outcome = await write.update(driver, update);
    if (outcome.status === "done") {
      onFinished();
    }
  }

  const vehicles = driver?.vehicles ?? 0;
  const copy = write.error ? driverWriteCopy(write.error, "update") : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={driver ? `Deactivate ${driver.name}?` : "Deactivate driver?"}
      description={
        driver
          ? `${driver.name} is assigned to ${formatCount(vehicles)} ${
              vehicles === 1 ? "vehicle" : "vehicles"
            }. Their vehicles stay assigned until you reassign them.`
          : undefined
      }
      footer={
        <>
          <Button ref={keepActiveRef} onClick={onCancel} disabled={write.pending}>
            Keep active
          </Button>
          <Button variant="destructive" loading={write.pending} onClick={() => void confirm()}>
            Deactivate driver
          </Button>
        </>
      }
    >
      {write.pending ? <SlowNotice /> : null}

      <div ref={errorRef} tabIndex={-1} className="focus:outline-none">
        {write.error && copy ? (
          <InlineError error={write.error} copy={copy} />
        ) : null}
      </div>
    </Dialog>
  );
}

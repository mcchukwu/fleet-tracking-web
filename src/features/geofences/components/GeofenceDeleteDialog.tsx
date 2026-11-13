import { useEffect, useRef, useState } from "react";
import type { Geofence } from "../../../api/types";
import { InlineError } from "../../../errors/InlineError";
import { SlowNotice } from "../../../errors/SlowNotice";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import type { GeofenceDeleteController } from "../hooks/useGeofenceDelete";
import { geofenceDeleteCopy } from "../lib/reconcile";

export interface GeofenceDeleteDialogProps {
  geofence: Geofence | null;
  open: boolean;
  write: GeofenceDeleteController;
  disabledReason?: string;
  onClose: () => void;
  onDeleted: () => void;
  onRefresh: () => Promise<void>;
}

export function GeofenceDeleteDialog({
  geofence,
  open,
  write,
  disabledReason,
  onClose,
  onDeleted,
  onRefresh,
}: GeofenceDeleteDialogProps) {
  "use no memo";
  const [blocked, setBlocked] = useState<{ title: string; detail: string } | null>(null);
  const [gone, setGone] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const resetWrite = write.reset;

  useEffect(() => {
    if (!open) return;
    // oxlint-disable-next-line react/set-state-in-effect -- opening a new target is an external reset event.
    setBlocked(null);
    // oxlint-disable-next-line react/set-state-in-effect -- opening a new target is an external reset event.
    setGone(false);
    resetWrite();
  }, [open, resetWrite]);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  async function confirm(): Promise<void> {
    if (!geofence || write.pending) return;
    const outcome = await write.remove(geofence);
    if (outcome.status === "deleted" || outcome.status === "reconciled") {
      onDeleted();
      return;
    }
    if (outcome.status === "blocked") {
      setBlocked(geofenceDeleteCopy(outcome.error));
      return;
    }
    if (outcome.status === "gone") {
      setGone(true);
    }
  }

  async function refresh(): Promise<void> {
    await onRefresh();
    setGone(false);
  }

  const failureCopy = write.error ? geofenceDeleteCopy(write.error) : null;
  const confirmDisabled = write.pending || Boolean(blocked) || Boolean(gone);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !write.pending) onClose();
      }}
      title={geofence ? `Delete geofence "${geofence.name}"?` : "Delete geofence?"}
      description={blocked ? undefined : "This can't be undone."}
      variant="confirm"
      footer={
        <>
          <Button ref={cancelRef} onClick={onClose} disabled={write.pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={write.pending}
            disabled={confirmDisabled}
            onClick={() => void confirm()}
          >
            Delete
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {blocked ? (
          <div
            role="alert"
            className="border-border bg-alert-bg flex flex-col gap-1 rounded-md border p-3"
          >
            <p className="text-alert-fg text-sm font-medium">{blocked.title}</p>
            <p className="text-alert-fg text-sm">{blocked.detail}</p>
          </div>
        ) : null}
        {gone ? (
          <div role="alert" className="text-danger flex items-center gap-2 text-sm">
            <span className="flex-1">This geofence no longer exists.</span>
            <Button size="sm" variant="ghost" onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>
        ) : null}
        {failureCopy && write.error && !blocked ? (
          <InlineError
            error={write.error}
            copy={failureCopy}
            {...(write.error.outcome === "failed" ? { onRetry: () => void confirm() } : {})}
          />
        ) : null}
        {write.pending ? <SlowNotice onCancel={write.cancel} onRetry={write.retry} /> : null}
        {disabledReason ? <p className="text-muted text-sm">{disabledReason}</p> : null}
      </div>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import type { Vehicle } from "../../../api/types";
import { useDrivers } from "../../../api/hooks/drivers";
import { InlineError } from "../../../errors/InlineError";
import { SlowNotice } from "../../../errors/SlowNotice";
import { Button } from "../../../ui/Button";
import { Combobox } from "../../../ui/Combobox";
import { Dialog } from "../../../ui/Dialog";
import { activeDrivers, driverDescription } from "../../../lib/drivers";
import { useVehicleWrite } from "../hooks/useVehicleWrite";

export interface AssignDriverDialogProps {
  open: boolean;
  vehicle: Vehicle;
  onClose: () => void;
  onSaved: () => void;
  onRefresh: () => void;
  readOnly: boolean;
  readOnlyReason?: string;
}

export function AssignDriverDialog({
  open,
  vehicle,
  onClose,
  onSaved,
  onRefresh,
  readOnly,
  readOnlyReason,
}: AssignDriverDialogProps) {
  const driversQuery = useDrivers();
  const write = useVehicleWrite(vehicle.id);
  const [driverId, setDriverId] = useState<string | null>(vehicle.driver_id ?? null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (write.error) errorRef.current?.focus();
  }, [write.error]);

  const drivers = activeDrivers(driversQuery.data ?? []);
  const items = drivers.map((driver) => ({
    id: driver.id,
    label: driver.name,
    description: driverDescription(driver),
  }));
  const unchanged = driverId === null || driverId === (vehicle.driver_id ?? "");

  async function submit(): Promise<void> {
    if (!driverId || unchanged) return;
    const outcome = await write.submit({ driver_id: driverId });
    if (outcome.status === "success" || outcome.status === "reconciled") {
      onSaved();
      onClose();
    }
  }

  const conflict =
    write.error?.kind === "conflict" || write.error?.kind === "not_found";
  const blockedReason = readOnlyReason ?? "Your role can't assign drivers.";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !write.pending) onClose();
      }}
      title={`Assign a driver to ${vehicle.plate}`}
      description={
        vehicle.driver_name
          ? `Currently ${vehicle.driver_name}. Choose another active driver.`
          : "Choose an active driver."
      }
      footer={
        <>
          <Button onClick={onClose} disabled={write.pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            loading={write.pending}
            disabled={unchanged || readOnly}
          >
            Assign driver
          </Button>
        </>
      }
    >
      {write.pending ? <SlowNotice /> : null}

      <div ref={errorRef} tabIndex={-1} className="focus:outline-none">
        {write.error ? (
          <div className="mb-3 space-y-2">
            <InlineError
              error={write.error}
              copy={
                conflict
                  ? {
                      title: "That driver is no longer available",
                      detail: "Choose another driver, or refresh to see the latest list.",
                    }
                  : undefined
              }
            />
            {conflict ? (
              <Button size="sm" onClick={onRefresh}>
                Refresh
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {readOnly ? (
        <p className="mb-3 text-sm text-muted">{blockedReason}</p>
      ) : null}

      {!driversQuery.isLoading && !driversQuery.error && drivers.length === 0 ? (
        <p className="mb-3 text-sm text-muted">No active drivers are available.</p>
      ) : null}

      <Combobox
        label="Driver"
        items={items}
        value={driverId}
        selectedLabel={vehicle.driver_name ?? undefined}
        onChange={setDriverId}
        loading={driversQuery.isLoading}
        error={driversQuery.error ? "Couldn't load drivers." : undefined}
        onRetry={() => void driversQuery.refetch()}
        emptyMessage="No active drivers"
        disabled={readOnly}
        disabledReason={readOnly ? blockedReason : undefined}
        placeholder="Search by name, phone or licence"
      />

      <p className="mt-3 text-xs text-muted">
        The current driver stays selected; this API can change a driver but not clear one.
      </p>
    </Dialog>
  );
}

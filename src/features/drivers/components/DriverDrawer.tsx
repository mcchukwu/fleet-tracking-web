import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Driver } from "../../../api/types";
import { useLiveSnapshot } from "../../../api/hooks/vehicles";
import { ErrorState } from "../../../errors/ErrorState";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";
import { MISSING, formatCount } from "../../../lib/format";
import { driverStatusLabel, isDriverStatus, vehiclesForDriver } from "../../../lib/drivers";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { CopyButton } from "../../../ui/CopyButton";
import { Drawer } from "../../../ui/Drawer";
import { Skeleton } from "../../../ui/StatePanel";
import { isDialablePhone } from "../lib/form";
import { DriverStatusBadge } from "./DriverStatusBadge";

export type DriverLookupState = "loading" | "ready" | "not-found" | "error" | "offline";

export interface DriverDrawerProps {
  driver: Driver | null;
  lookup: DriverLookupState;
  lookupError?: AppError | null;
  offline: boolean;
  disabledReason?: string;
  onEdit: () => void;
  onClose: () => void;
  onRetryLookup: () => void;
  returnFocus?: () => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-muted shrink-0 text-xs">{label}</dt>
      <dd className="text-text min-w-0 text-right text-sm">{children}</dd>
    </div>
  );
}

function phoneHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, "")}`;
}

export function DriverDrawer(props: DriverDrawerProps) {
  const { driver, lookup, lookupError, onClose, onRetryLookup, returnFocus, offline } = props;

  return (
    <Drawer
      open
      placement="page"
      label="Driver details"
      title={driver?.name ?? "Driver"}
      titleClassName="font-sans"
      closeLabel="Close driver details"
      headerAside={
        driver ? (
          isDriverStatus(driver.status) ? (
            <DriverStatusBadge status={driver.status} />
          ) : (
            <Badge tone="neutral">Unknown status: {driver.status}</Badge>
          )
        ) : undefined
      }
      actions={
        driver ? (
          <Button
            size="sm"
            variant="secondary"
            data-detail-action
            {...(props.disabledReason ? { disabledReason: props.disabledReason } : {})}
            onClick={props.onEdit}
          >
            Edit driver
          </Button>
        ) : undefined
      }
      onClose={onClose}
      returnFocus={returnFocus}
    >
      {lookup === "loading" ? (
        <div aria-busy="true" aria-label="Loading driver" className="space-y-3 p-4">
          <Skeleton className="w-2/3" />
          <Skeleton className="w-1/2" />
          <Skeleton className="w-full" />
        </div>
      ) : lookup === "error" && lookupError ? (
        <ErrorState error={lookupError} onRetry={onRetryLookup} className="py-8" />
      ) : lookup === "offline" ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <p className="text-text text-base font-medium">This driver isn't available offline</p>
          <p className="text-muted text-sm">Reconnect to load the driver list.</p>
          <Button size="sm" onClick={onClose}>
            Back to drivers
          </Button>
        </div>
      ) : !driver ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <p className="text-text text-base font-medium">Driver not found</p>
          <p className="text-muted text-sm">It may have been removed.</p>
          <Button size="sm" onClick={onClose}>
            Back to drivers
          </Button>
        </div>
      ) : (
        <DriverDetails driver={driver} offline={offline} />
      )}
    </Drawer>
  );
}

function DriverDetails({ driver, offline }: { driver: Driver; offline: boolean }) {
  const snapshot = useLiveSnapshot();
  const assigned = vehiclesForDriver(snapshot.data ?? [], driver.id);
  const snapshotError = snapshot.error ? normalize(snapshot.error) : null;
  const statusLabel = driverStatusLabel(driver.status);

  return (
    <div className="flex flex-col gap-4 p-4">
      {offline ? <p className="text-muted text-xs">Showing the last loaded vehicles.</p> : null}

      <section aria-labelledby="driver-contact-heading">
        <h3 id="driver-contact-heading" className="text-text mb-1 text-sm font-medium">
          Contact
        </h3>
        <dl>
          <Field label="Phone">
            {isDialablePhone(driver.phone) ? (
              <a
                href={phoneHref(driver.phone)}
                className="focus-visible:outline-focus-ring inline-flex h-touch items-center rounded-sm font-mono underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-0 md:h-auto"
              >
                {driver.phone}
              </a>
            ) : (
              driver.phone || MISSING
            )}
          </Field>
          <Field label="Licence">
            {driver.licence ? (
              <CopyButton inline value={driver.licence} label="licence" className="text-xs" />
            ) : (
              MISSING
            )}
          </Field>
          <Field label="Status">{statusLabel}</Field>
          <Field label="Driver id">
            <CopyButton
              inline
              value={driver.id}
              label="driver id"
              className="text-xs break-all"
            />
          </Field>
        </dl>
      </section>

      <section aria-labelledby="driver-vehicles-heading">
        <h3 id="driver-vehicles-heading" className="text-text mb-1 text-sm font-medium">
          Assigned vehicles
        </h3>
        <dl>
          <Field label="Server count">
            <span className="tabular-nums">{formatCount(driver.vehicles)}</span>
          </Field>
        </dl>

        {snapshot.isPending && !snapshot.data ? (
          <div aria-busy="true" aria-label="Loading assigned vehicles" className="space-y-2 pt-2">
            <Skeleton className="w-1/2" />
            <Skeleton className="w-2/3" />
          </div>
        ) : snapshotError ? (
          <ErrorState
            error={snapshotError}
            compact
            onRetry={() => void snapshot.refetch()}
          />
        ) : assigned.length === 0 ? (
          <p className="text-muted pt-1 text-sm">No vehicles assigned.</p>
        ) : (
          <ul className="border-border mt-1 divide-y rounded-md border">
            {assigned.map((vehicle) => (
              <li
                key={vehicle.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <Link
                  to="/map"
                  search={{ v: vehicle.id }}
                  className="focus-visible:outline-focus-ring inline-flex h-touch items-center rounded-sm font-mono text-sm text-text underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-0 md:h-auto"
                >
                  {vehicle.plate}
                </Link>
                <span className="text-muted truncate text-xs">{vehicle.depot || MISSING}</span>
              </li>
            ))}
          </ul>
        )}

        {snapshot.data && assigned.length !== driver.vehicles ? (
          <p className="text-muted mt-2 text-xs">
            The server counts {formatCount(driver.vehicles)}; this list shows the current snapshot
            ({formatCount(assigned.length)}).
          </p>
        ) : null}

        {driver.status === "inactive" && assigned.length > 0 ? (
          <p className="text-muted mt-2 text-xs">
            Inactive drivers keep their current vehicle assignments.
          </p>
        ) : null}
      </section>
    </div>
  );
}

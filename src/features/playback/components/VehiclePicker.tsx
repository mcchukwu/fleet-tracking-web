import { useLiveSnapshot } from "../../../api/hooks/vehicles";
import type { SnapshotVehicle } from "../../../api/types";
import { normalize } from "../../../errors/normalize";
import { useDelayedFlag } from "../../../lib/useDelayedFlag";
import { useConnection } from "../../../stores/connection";
import { Button } from "../../../ui/Button";
import { Combobox, type ComboboxItem } from "../../../ui/Combobox";
import { EmptyState, Skeleton } from "../../../ui/StatePanel";
import { ErrorState } from "../../../errors/ErrorState";
import { ForbiddenState } from "../../../ui/StatePanel";
import { cn } from "../../../ui/cn";

export interface VehiclePickerProps {
  value: string | null;
  onChange: (id: string) => void;
  onBack?: () => void;
  initialFocus?: boolean;
  className?: string;
}

function toItems(vehicles: readonly SnapshotVehicle[]): ComboboxItem[] {
  return vehicles.map((vehicle) => ({
    id: vehicle.id,
    label: vehicle.plate,
    description: [vehicle.external_id, vehicle.depot]
      .filter(Boolean)
      .join(" · "),
    labelClassName: "font-mono",
  }));
}

function VehiclePickerSkeleton() {
  return (
    <div aria-label="Loading vehicles" className="flex flex-col gap-3 p-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-touch md:h-control-md w-full" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function VehiclePicker({
  value,
  onChange,
  onBack,
  initialFocus = false,
  className,
}: VehiclePickerProps) {
  const snapshot = useLiveSnapshot();
  const { network } = useConnection();
  const offline = network === "offline";
  const rows = snapshot.data ?? [];
  const showSkeleton = useDelayedFlag(snapshot.isPending && rows.length === 0);

  if (rows.length === 0 && offline) {
    return (
      <div
        className={cn("border-border bg-surface rounded-lg border", className)}
      >
        <EmptyState
          title="Not available offline"
          description="Vehicles aren't available offline."
          action={
            onBack ? (
              <Button size="sm" variant="ghost" onClick={onBack}>
                Back to map
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  if (rows.length === 0 && snapshot.isError) {
    const error = normalize(snapshot.error, {
      resource: "vehicles",
      action: "load vehicles",
    });
    return (
      <div
        className={cn("border-border bg-surface rounded-lg border", className)}
      >
        {error.kind === "forbidden" ? (
          <ForbiddenState
            action={
              onBack ? (
                <Button size="sm" variant="ghost" onClick={onBack}>
                  Back to map
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ErrorState error={error} onRetry={() => void snapshot.refetch()} />
        )}
      </div>
    );
  }

  if (showSkeleton) {
    return (
      <div
        className={cn("border-border bg-surface rounded-lg border", className)}
        aria-busy="true"
      >
        <VehiclePickerSkeleton />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className={cn("border-border bg-surface rounded-lg border", className)}
      >
        <EmptyState
          title="No vehicles yet"
          description="Vehicles appear here when they report."
          action={
            onBack ? (
              <Button size="sm" variant="ghost" onClick={onBack}>
                Back to map
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <Combobox
      label="Vehicle"
      items={toItems(rows)}
      value={value}
      onChange={onChange}
      placeholder="Search by plate or IMEI"
      emptyMessage="No vehicles match"
      initialFocus={initialFocus}
      className={className}
    />
  );
}

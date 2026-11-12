import type { SnapshotVehicle, Vehicle } from "../../../api/types";
import { useVehicle } from "../../../api/hooks/vehicles";
import { normalize } from "../../../errors/normalize";
import { Badge, StatusPill } from "../../../ui/Badge";
import { CopyButton } from "../../../ui/CopyButton";
import { Drawer } from "../../../ui/Drawer";
import type { VehicleRow } from "../lib/filter";
import { VehicleActions } from "./VehicleActions";
import { VehicleDetailBody } from "./VehicleDetailBody";

export interface VehicleDrawerProps {
  vehicleId: string;
  row: VehicleRow | null;
  snapshotVehicle: SnapshotVehicle | null;
  mapReady: boolean;
  canMutate: boolean;
  mutateReason?: string | null;
  offline: boolean;
  onClose: () => void;
  onCentre: (position?: { lat: number; lon: number }) => void;
  onPlayback: () => void;
  onEdit?: (vehicle: Vehicle) => void;
  onAssign?: (vehicle: Vehicle) => void;
  returnFocus?: () => void;
}

/** Dev-only render-crash injection for the e2e fault matrix. */
const INJECT_CRASH =
  import.meta.env.DEV &&
  import.meta.env.VITE_MOCK === "1" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("crash") === "vehicle-drawer";

export function VehicleDrawer({
  vehicleId,
  row,
  snapshotVehicle,
  mapReady,
  canMutate,
  mutateReason,
  offline,
  onClose,
  onCentre,
  onPlayback,
  onEdit,
  onAssign,
  returnFocus,
}: VehicleDrawerProps) {
  const vehicleQuery = useVehicle(vehicleId);
  const vehicle = vehicleQuery.data;
  const detailError = vehicleQuery.error && !offline ? normalize(vehicleQuery.error) : null;
  const notFound = detailError?.kind === "not_found";
  const plate = row?.plate ?? snapshotVehicle?.plate ?? vehicle?.plate ?? "Vehicle";
  const status = row?.status ?? (vehicle?.online ? "idle" : "offline");
  const lat = row?.lat ?? vehicle?.lat ?? null;
  const lon = row?.lon ?? vehicle?.lon ?? null;
  const hasPosition = lat !== null && lon !== null;
  const hasDetail = vehicle !== undefined && !notFound;

  if (INJECT_CRASH) throw new Error("Injected vehicle drawer crash");

  return (
    <Drawer
      open
      label={`Vehicle details for ${plate}`}
      title={<CopyButton value={plate} label="Plate" className="text-md" />}
      headerAside={
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          {row?.stale ? <Badge tone="warning">Stale</Badge> : null}
        </div>
      }
      actions={
        <VehicleActions
          onCentre={() => {
            onCentre(hasPosition && lat !== null && lon !== null ? { lat, lon } : undefined);
          }}
          onPlayback={onPlayback}
          onEdit={() => {
            if (vehicle) onEdit?.(vehicle);
          }}
          onAssign={() => {
            if (vehicle) onAssign?.(vehicle);
          }}
          mapReady={mapReady}
          hasPosition={hasPosition}
          canMutate={canMutate}
          mutateReason={mutateReason}
          hasVehicle={!notFound}
          canEdit={hasDetail}
        />
      }
      onClose={onClose}
      returnFocus={returnFocus}
    >
      <VehicleDetailBody
        vehicleId={vehicleId}
        row={row}
        snapshotVehicle={snapshotVehicle}
        offline={offline}
        onClose={onClose}
      />
    </Drawer>
  );
}

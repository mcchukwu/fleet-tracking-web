import { History, LocateFixed, Pencil, UserRound } from "lucide-react";
import { DrawerActionButton } from "./DrawerActionButton";

export interface VehicleActionsProps {
  variant?: "labels" | "icons";
  onCentre: () => void;
  onPlayback: () => void;
  onEdit: () => void;
  onAssign: () => void;
  mapReady: boolean;
  hasPosition: boolean;
  canMutate: boolean;
  offline: boolean;
  hasVehicle?: boolean;
}

export function VehicleActions({
  variant = "labels",
  onCentre,
  onPlayback,
  onEdit,
  onAssign,
  mapReady,
  hasPosition,
  canMutate,
  offline,
  hasVehicle = true,
}: VehicleActionsProps) {
  const iconOnly = variant === "icons";
  const centreReason = !mapReady
    ? "The map couldn't load."
    : !hasPosition
      ? "No position reported."
      : undefined;
  const playbackReason = !hasVehicle ? "Vehicle not found." : undefined;
  const editReason = !canMutate
    ? "Your role can't edit vehicles."
    : offline
      ? "You're offline."
      : !hasVehicle
        ? "Vehicle not found."
        : undefined;
  const assignReason = !canMutate
    ? "Your role can't assign drivers."
    : offline
      ? "You're offline."
      : !hasVehicle
        ? "Vehicle not found."
        : undefined;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <DrawerActionButton
        label="Centre on map"
        iconOnly={iconOnly}
        icon={<LocateFixed aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        onClick={onCentre}
        disabledReason={centreReason}
      />
      <DrawerActionButton
        label="Play back"
        iconOnly={iconOnly}
        icon={<History aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        onClick={onPlayback}
        disabledReason={playbackReason}
      />
      <DrawerActionButton
        label="Edit"
        iconOnly={iconOnly}
        icon={<Pencil aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        onClick={onEdit}
        disabledReason={editReason}
      />
      <DrawerActionButton
        label="Assign driver"
        accessibleName="Assign driver"
        iconOnly={iconOnly}
        icon={<UserRound aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        onClick={onAssign}
        disabledReason={assignReason}
      />
    </div>
  );
}

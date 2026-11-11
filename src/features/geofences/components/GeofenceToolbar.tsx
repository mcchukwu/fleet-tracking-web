import { Pencil, Trash2 } from "lucide-react";
import type { Geofence } from "../../../api/types";
import { Button } from "../../../ui/Button";
import { GeofenceKindBadge } from "./GeofenceKindBadge";

export interface GeofenceToolbarProps {
  selected: Geofence | null;
  canMutate: boolean;
  offline: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function GeofenceToolbar({
  selected,
  canMutate,
  offline,
  onEdit,
  onDelete,
}: GeofenceToolbarProps) {
  const roleReason = canMutate ? null : "Your role can't change geofences.";
  const reason = roleReason ?? (offline ? "You're offline." : null);

  return (
    <div className="border-border flex h-11 shrink-0 items-center gap-2 border-b px-3">
      {selected ? (
        <>
          <span className="text-text min-w-0 flex-1 truncate text-sm" title={selected.name}>
            {selected.name}
          </span>
          <GeofenceKindBadge kind={selected.kind} />
          <Button
            size="sm"
            variant="ghost"
            data-edit-geofence
            leadingIcon={<Pencil aria-hidden="true" className="size-3.5" strokeWidth={1.5} />}
            {...(reason ? { disabledReason: reason } : {})}
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<Trash2 aria-hidden="true" className="size-3.5" strokeWidth={1.5} />}
            {...(reason ? { disabledReason: reason } : {})}
            onClick={onDelete}
          >
            Delete
          </Button>
        </>
      ) : (
        <p className="text-muted text-sm">Select a geofence to edit.</p>
      )}
    </div>
  );
}

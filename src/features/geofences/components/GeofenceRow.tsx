import type { Geofence } from "../../../api/types";
import { cn } from "../../../ui/cn";
import { GeofenceKindBadge } from "./GeofenceKindBadge";

export interface GeofenceRowProps {
  geofence: Geofence;
  selected: boolean;
  onSelect: () => void;
}

export function GeofenceRow({ geofence, selected, onSelect }: GeofenceRowProps) {
  return (
    <li>
      <button
        type="button"
        data-geofence-id={geofence.id}
        data-geofence-row
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className={cn(
          "focus-visible:outline-focus-ring hover:bg-surface-2 flex h-12 w-full items-center gap-2 border-l-2 px-3 text-left transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-0",
          selected ? "border-accent bg-accent-soft" : "border-transparent",
        )}
      >
        <GeofenceKindBadge kind={geofence.kind} />
        <span className="text-text min-w-0 flex-1 truncate text-sm" title={geofence.name}>
          {geofence.name}
        </span>
      </button>
    </li>
  );
}

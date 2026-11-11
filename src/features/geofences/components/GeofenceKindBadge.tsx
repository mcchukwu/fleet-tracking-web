import { Badge } from "../../../ui/Badge";
import { cn } from "../../../ui/cn";
import { geofenceKindInfo } from "../lib/kinds";

/** Kind is never colour alone: the swatch carries the stroke pattern and the label names it. */
export function GeofenceKindBadge({ kind }: { kind: string }) {
  const info = geofenceKindInfo(kind);
  return (
    <Badge>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          data-kind-swatch={info.id}
          className={cn("inline-block w-4 shrink-0", info.swatchClassName)}
        />
        <span className="truncate">{info.label}</span>
      </span>
    </Badge>
  );
}

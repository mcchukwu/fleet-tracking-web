import { CircleHelp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../../../ui/DropdownMenu";
import { IconButton } from "../../../ui/IconButton";
import { cn } from "../../../ui/cn";
import { GEOFENCE_KIND_ORDER, geofenceKindInfo } from "../lib/kinds";

export function GeofenceLegend() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          label="Geofence kinds legend"
          size="sm"
          icon={<CircleHelp aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-w-full p-3">
        <DropdownMenuLabel>Geofence kinds</DropdownMenuLabel>
        <ul className="mt-2 flex flex-col gap-2">
          {GEOFENCE_KIND_ORDER.map((kind) => {
            const info = geofenceKindInfo(kind);
            return (
              <li key={kind} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={cn("mt-1.5 inline-block w-4 shrink-0", info.swatchClassName)}
                />
                <span className="min-w-0">
                  <span className="text-text font-medium">{info.label}</span>
                  <span className="text-muted"> · {info.stroke}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

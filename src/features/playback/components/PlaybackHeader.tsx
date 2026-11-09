import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { SnapshotVehicle } from "../../../api/types";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { CopyButton } from "../../../ui/CopyButton";
import { cn } from "../../../ui/cn";

export interface PlaybackHeaderProps {
  vehicle: Pick<SnapshotVehicle, "id" | "plate"> & Partial<Pick<SnapshotVehicle, "external_id">>;
  offline: boolean;
  onChangeVehicle: () => void;
  className?: string;
}

export function PlaybackHeader({
  vehicle,
  offline,
  onChangeVehicle,
  className,
}: PlaybackHeaderProps) {
  return (
    <header
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2 shadow-float",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            to="/map"
            search={{ v: vehicle.id }}
            aria-label="Back to map"
            className="inline-flex size-touch items-center justify-center rounded-sm text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring md:size-control-sm"
          >
            <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.5} />
          </Link>
          <h1 className="text-md font-medium text-text">Playback</h1>
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
          <CopyButton value={vehicle.plate} label="Plate" inline className="font-mono">
            {vehicle.plate}
          </CopyButton>
          {vehicle.external_id ? (
            <CopyButton
              value={vehicle.external_id}
              label="IMEI"
              inline
              className="font-mono text-xs text-muted"
            >
              {vehicle.external_id}
            </CopyButton>
          ) : null}
          {offline ? <Badge tone="warning">Offline · showing saved data</Badge> : null}
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={onChangeVehicle}>
        Change vehicle
      </Button>
    </header>
  );
}

import { formatSpeed } from "../../../lib/format";
import { StatusPill } from "../../../ui/Badge";
import { CopyButton } from "../../../ui/CopyButton";
import { Timestamp } from "../../../ui/Timestamp";
import { cn } from "../../../ui/cn";
import type { VehicleRow as VehicleRowData } from "../lib/filter";

export function rowBoxStyle(height: number) {
  return { height };
}

export interface VehicleRowProps {
  row: VehicleRowData;
  height: number;
  selected: boolean;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
}

export function VehicleRow({ row, height, selected, onSelect, onHover }: VehicleRowProps) {
  const ageTone =
    row.freshness === "stale"
      ? "text-alert-fg"
      : row.freshness === "delayed"
        ? "text-idle-fg"
        : "text-muted";

  return (
    <div
      data-vehicle-key={row.key}
      style={rowBoxStyle(height)}
      className={cn(
        "group relative",
        selected ? "bg-accent-soft" : "hover:bg-surface-2 focus-within:bg-surface-2",
      )}
    >
      {selected ? (
        <span aria-hidden="true" className="bg-accent absolute inset-y-0 left-0 w-0.5" />
      ) : null}
      <span
        aria-hidden="true"
        data-testid="row-divider"
        className="bg-border pointer-events-none absolute inset-x-0 bottom-0 h-px"
      />
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`Select ${row.plate}`}
        className="focus-visible:outline-focus-ring absolute inset-0 w-full rounded-none focus-visible:outline-2 focus-visible:outline-offset-0"
        onClick={() => onSelect(row.key)}
        onPointerEnter={() => onHover(row.key)}
        onPointerLeave={() => onHover(null)}
        onFocus={() => onHover(row.key)}
        onBlur={() => onHover(null)}
      />
      <div className="pointer-events-none relative flex h-full flex-col justify-center gap-0.5 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <StatusPill status={row.status} />
          <span data-row-inline-action className="pointer-events-auto inline-flex shrink-0">
            <CopyButton inline value={row.plate} label="Plate" className="text-sm" />
          </span>
          <span className={cn("ml-auto shrink-0 text-xs tabular-nums", ageTone)}>
            {row.recordedAt ? (
              <Timestamp iso={row.recordedAt} />
            ) : (
              <span aria-label="Never reported">—</span>
            )}
          </span>
        </div>
        <div className="text-muted flex min-w-0 items-center gap-2 text-xs">
          <span className="truncate">{row.driverName ?? "—"}</span>
          <span className="ml-auto shrink-0 tabular-nums">
            {row.lat === null || row.lon === null
              ? "No position reported"
              : formatSpeed(row.speedKph)}
          </span>
        </div>
      </div>
    </div>
  );
}

import { formatAgeSeconds, formatSpeed } from "../../../lib/format";
import type { VehicleRow } from "../lib/filter";

export function tooltipStyle(point: { x: number; y: number }) {
  return {
    left: Math.min(point.x + 14, 240),
    top: Math.max(8, point.y - 64),
  };
}

export interface MapTooltipProps {
  row: VehicleRow;
  point: { x: number; y: number };
}

export function MapTooltip({ row, point }: MapTooltipProps) {
  return (
    <div
      role="tooltip"
      style={tooltipStyle(point)}
      className="pointer-events-none absolute z-20 max-w-panel rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-menu"
    >
      <p className="font-mono font-medium text-text">{row.plate}</p>
      <p className="text-muted">
        {formatSpeed(row.speedKph)} · {formatAgeSeconds(row.ageSeconds)} ago
      </p>
    </div>
  );
}

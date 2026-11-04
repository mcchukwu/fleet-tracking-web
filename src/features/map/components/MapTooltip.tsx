import { useLayoutEffect, useRef, useState } from "react";
import { formatAgeSeconds, formatSpeed } from "../../../lib/format";
import type { VehicleRow } from "../lib/filter";

export interface Size {
  width: number;
  height: number;
}

const EDGE_MARGIN = 8;

export function tooltipStyle(
  point: { x: number; y: number },
  container?: Size,
  tooltip?: Size,
): { left: number; top: number } {
  const width = tooltip?.width ?? 0;
  const height = tooltip?.height ?? 0;
  const maxLeft = container ? container.width - width - EDGE_MARGIN : Number.POSITIVE_INFINITY;
  const maxTop = container ? container.height - height - EDGE_MARGIN : Number.POSITIVE_INFINITY;
  return {
    left: Math.max(EDGE_MARGIN, Math.min(point.x + 14, maxLeft)),
    top: Math.max(EDGE_MARGIN, Math.min(point.y - 64, maxTop)),
  };
}

export interface MapTooltipProps {
  row: VehicleRow;
  point: { x: number; y: number };
}

function speedText(row: VehicleRow): string {
  if (row.speedKph === null) return "No speed reported";
  if (row.speedReportedAtMs === null) return formatSpeed(row.speedKph);
  const age = Math.max(0, Math.floor((Date.now() - row.speedReportedAtMs) / 1_000));
  return `${formatSpeed(row.speedKph)} · reported ${formatAgeSeconds(age)} ago`;
}

export function MapTooltip({ row, point }: MapTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<{ tooltip: Size; container?: Size }>({
    tooltip: { width: 0, height: 0 },
  });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const parent = element.parentElement;
    setMetrics({
      tooltip: { width: element.offsetWidth, height: element.offsetHeight },
      ...(parent ? { container: { width: parent.clientWidth, height: parent.clientHeight } } : {}),
    });
  }, [row.key, row.plate]);

  return (
    <div
      ref={ref}
      role="tooltip"
      style={tooltipStyle(point, metrics.container, metrics.tooltip)}
      className="pointer-events-none absolute z-20 max-w-panel rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-menu"
    >
      <p className="font-mono font-medium text-text">{row.plate}</p>
      <p className="text-muted">{speedText(row)}</p>
      <p className="text-muted">
        {row.ageSeconds === null
          ? "No position reported"
          : `Position ${formatAgeSeconds(row.ageSeconds)} ago`}
      </p>
    </div>
  );
}

import { mapConfig } from "../../../map/config";
import type { MapStyleId } from "../../../map/types";
import { cn } from "../../../ui/cn";

export interface MapAttributionProps {
  styleId: MapStyleId;
  attribution?: readonly string[] | null;
  className?: string;
}

export function MapAttribution({ styleId, attribution, className }: MapAttributionProps) {
  const hosted = styleId === "streets" || styleId === "satellite";
  const hostedLabel = attribution?.join(" · ") ?? "";
  if (hosted && hostedLabel === "") return null;

  const classes = cn(
    "pointer-events-auto inline-flex min-h-touch max-w-full items-center rounded-md border border-border bg-surface px-2 text-2xs whitespace-nowrap text-muted shadow-menu md:min-h-control-sm md:py-0",
    className,
  );

  if (hosted) {
    return (
      <span data-testid="map-attribution" className={classes}>
        {hostedLabel}
      </span>
    );
  }

  const credit = mapConfig.attribution;
  return (
    <a
      data-testid="map-attribution"
      href={credit.href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        classes,
        "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring",
      )}
    >
      {credit.label}
    </a>
  );
}

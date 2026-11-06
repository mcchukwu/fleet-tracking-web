import { mapConfig, type SatelliteConfig } from "../../../map/config";
import type { MapStyleId } from "../../../map/types";
import { cn } from "../../../ui/cn";

export interface MapAttributionProps {
  styleId: MapStyleId;
  satellite?: SatelliteConfig | null;
  className?: string;
}

export function MapAttribution({ styleId, satellite, className }: MapAttributionProps) {
  const credit =
    styleId === "satellite" && satellite
      ? { label: satellite.attribution, href: satellite.attributionHref }
      : mapConfig.attribution;

  const classes = cn(
    "inline-flex min-h-touch items-center rounded-md border border-border bg-surface px-2 text-xs text-muted shadow-menu md:min-h-control-sm md:py-0",
    className,
  );

  if (!credit.href) {
    return <span className={classes}>{credit.label}</span>;
  }

  return (
    <a
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

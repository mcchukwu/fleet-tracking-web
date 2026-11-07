import { MAPTILER_HOME } from "../../../map/config";
import { cn } from "../../../ui/cn";

export interface MapTilerLogoProps {
  className?: string;
}

export function MapTilerLogo({ className }: MapTilerLogoProps) {
  return (
    <a
      data-testid="maptiler-logo"
      href={MAPTILER_HOME}
      target="_blank"
      rel="noreferrer"
      aria-label="MapTiler"
      className={cn(
        "pointer-events-auto inline-flex min-h-touch items-center rounded-md border border-border bg-surface px-2 shadow-menu focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring md:min-h-control-sm",
        className,
      )}
    >
      <img src="/maptiler-logo-light.svg" alt="" width={67} height={20} className="h-4 w-auto dark:hidden" />
      <img src="/maptiler-logo-dark.svg" alt="" width={67} height={20} className="hidden h-4 w-auto dark:block" />
    </a>
  );
}

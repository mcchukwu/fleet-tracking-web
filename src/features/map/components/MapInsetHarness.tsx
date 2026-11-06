import { useEffect } from "react";
import type { RefObject } from "react";

export interface MapInsetHarnessProps {
  open: boolean;
  target: RefObject<HTMLElement | null>;
}

/**
 * Dev-only stand-in for the Slice 3 drawer. It publishes the same
 * `--map-inset-right` contract so the control shift can be tested now.
 */
export function MapInsetHarness({ open, target }: MapInsetHarnessProps) {
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    if (open) element.style.setProperty("--map-inset-right", "432px");
    else element.style.removeProperty("--map-inset-right");
    return () => {
      element.style.removeProperty("--map-inset-right");
    };
  }, [open, target]);

  if (!open) return null;

  return (
    <aside
      data-testid="map-inset-harness"
      aria-label="Drawer inset harness"
      className="absolute bottom-3 right-3 top-3 z-20 w-drawer rounded-lg border border-border bg-surface p-3 text-sm text-muted shadow-float"
    >
      Drawer inset harness
    </aside>
  );
}

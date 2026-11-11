import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type OverlayLayer = "dialog" | "popover" | "toast" | "tooltip";

const ROOT_ID = "overlay-root";
const LAYER_ATTRIBUTE = "data-layer-portal";

const LAYER_CLASS: Record<OverlayLayer, string> = {
  dialog: "layer-portal z-dialog",
  popover: "layer-portal z-popover",
  toast: "layer-portal z-toast",
  tooltip: "layer-portal z-tooltip",
};

function overlayRoot(): HTMLElement {
  const existing = document.getElementById(ROOT_ID);
  if (existing) return existing;
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "Overlays");
  document.body.appendChild(root);
  return root;
}

function layerContainer(layer: OverlayLayer): HTMLElement {
  const root = overlayRoot();
  const selector = `:scope > [${LAYER_ATTRIBUTE}="${layer}"]`;
  const existing = root.querySelector<HTMLElement>(selector);
  if (existing) return existing;
  const container = document.createElement("div");
  container.setAttribute(LAYER_ATTRIBUTE, layer);
  container.className = LAYER_CLASS[layer];
  root.appendChild(container);
  if (layer !== "dialog") {
    // A modal dialog hides every sibling from assistive technology. Menus,
    // comboboxes and tooltips opened from inside the dialog are part of that
    // dialog, so the overlay layers must stay exposed while it is open.
    const observer = new MutationObserver(() => {
      for (const attribute of ["aria-hidden", "data-aria-hidden"]) {
        if (container.getAttribute(attribute) === "true") {
          container.removeAttribute(attribute);
        }
      }
    });
    observer.observe(container, {
      attributes: true,
      attributeFilter: ["aria-hidden", "data-aria-hidden"],
    });
  }
  return container;
}

export interface LayerPortalProps {
  layer: OverlayLayer;
  children: ReactNode;
}

/**
 * Renders an overlay into the one overlay root, inside the container that owns
 * its layer. Radix and the combobox therefore share one stacking order instead
 * of each choosing a z-index inside whichever ancestor happened to render it.
 */
export function LayerPortal({ layer, children }: LayerPortalProps) {
  const [container] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : layerContainer(layer),
  );

  return container ? createPortal(children, container) : null;
}

/** True when a pointer event landed in a popover portalled above a dialog. */
export function isPortalledPopoverTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(`[${LAYER_ATTRIBUTE}="popover"]`) !== null
  );
}

const CONTENT_OVERLAY_ID = "content-overlay-root";
const CONTENT_OVERLAY_FALLBACK_ID = "content-overlay-fallback";

/**
 * The page drawer's containing block: the shell content area, so a banner in
 * flow above it can never be covered by a viewport-fixed panel.
 *
 * The shell root must be looked up after commit: a route can render its drawer
 * in the very first commit, before the shell's root is in the DOM, and a
 * body-level fallback would put the drawer over the top bar.
 */
export function contentOverlayRoot(): HTMLElement {
  const existing = document.getElementById(CONTENT_OVERLAY_ID);
  if (existing) return existing;
  const fallback = document.getElementById(CONTENT_OVERLAY_FALLBACK_ID);
  if (fallback) return fallback;
  const container = document.createElement("div");
  container.id = CONTENT_OVERLAY_FALLBACK_ID;
  container.className = "pointer-events-none absolute inset-0 z-drawer";
  document.body.appendChild(container);
  return container;
}

export function ContentPortal({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- the shell root exists only after commit.
    setContainer(contentOverlayRoot());
  }, []);

  return container ? createPortal(children, container) : null;
}

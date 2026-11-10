import { useDocumentTitle } from "../lib/useDocumentTitle";
import { LayerPortal } from "../ui/LayerPortal";

const SWATCH =
  "fixed left-0 top-0 flex h-12 w-60 items-center justify-center border border-border bg-surface text-sm text-text";

/**
 * Dev-only visual contract for the layer scale. Every swatch covers the same
 * point in the top bar, so elementFromPoint proves the order:
 * drawer < topbar < dialog < popover < toast < tooltip.
 */
export function LayerStack() {
  useDocumentTitle("Layer stack");

  return (
    <div className="max-w-content text-text mx-auto flex w-full flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-lg font-semibold">Layer stack</h1>
      <p className="text-muted max-w-prose text-sm">
        Six layers overlap at the top-left point. The drawer is trapped in the
        isolated content area, the top bar is shell chrome, and the four overlay
        layers are portalled into the overlay root.
      </p>

      <div data-testid="layer-swatch-drawer" className={`${SWATCH} z-drawer`}>
        drawer
      </div>

      <LayerPortal layer="dialog">
        <div data-testid="layer-swatch-dialog" className={SWATCH}>
          dialog
        </div>
      </LayerPortal>

      <LayerPortal layer="popover">
        <div data-testid="layer-swatch-popover" className={SWATCH}>
          popover
        </div>
      </LayerPortal>

      <LayerPortal layer="toast">
        <div data-testid="layer-swatch-toast" className={SWATCH}>
          toast
        </div>
      </LayerPortal>

      <LayerPortal layer="tooltip">
        <div data-testid="layer-swatch-tooltip" className={SWATCH}>
          tooltip
        </div>
      </LayerPortal>

      <ol className="text-muted mt-16 flex flex-col gap-1 text-sm">
        <li>1. drawer</li>
        <li>2. top bar</li>
        <li>3. dialog</li>
        <li>4. popover</li>
        <li>5. toast</li>
        <li>6. tooltip</li>
      </ol>
    </div>
  );
}

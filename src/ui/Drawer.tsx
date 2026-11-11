import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./IconButton";
import { cn } from "./cn";
import { ContentPortal } from "./LayerPortal";

export interface DrawerProps {
  open: boolean;
  /** Accessible name, e.g. "Vehicle details for LSD-100-AA". */
  label: string;
  title: ReactNode;
  headerAside?: ReactNode;
  actions?: ReactNode;
  /** The map panel floats inside the map; a page panel floats in the content area. */
  placement?: "map" | "page";
  closeLabel?: string;
  titleClassName?: string;
  onClose: () => void;
  /** Called when the panel leaves the screen so focus can return to its origin. */
  returnFocus?: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Non-modal drawer. The map stays interactive, so focus is not trapped;
 * Escape and focus return are handled explicitly. Modals stay in Dialog.
 * Page placement is a right panel at md+ and a top-quarter sheet below md.
 */
export function Drawer({
  open,
  label,
  title,
  headerAside,
  actions,
  placement = "map",
  closeLabel,
  titleClassName,
  onClose,
  returnFocus,
  children,
  className,
}: DrawerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const returnRef = useRef(returnFocus);

  useEffect(() => {
    returnRef.current = returnFocus;
  }, [returnFocus]);

  // A page drawer is portalled after the shell's content root exists, so the
  // close button can mount after the open effect has run.
  const setCloseRef = useCallback(
    (node: HTMLButtonElement | null) => {
      closeRef.current = node;
      if (node && open) node.focus();
    },
    [open],
  );

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    return () => {
      returnRef.current?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const active = document.activeElement;
      // A modal opened from the drawer owns Escape; it must not close the panel.
      if (active instanceof HTMLElement && active.closest('[role="dialog"]'))
        return;
      if (!(active instanceof Node) || !panelRef.current?.contains(active))
        return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const resolvedCloseLabel =
    closeLabel ??
    (placement === "map" ? "Close vehicle details" : "Close details");

  const panel = (
    <aside
      ref={panelRef}
      aria-label={label}
      aria-labelledby={label ? undefined : titleId}
      data-testid="drawer"
      data-placement={placement}
      className={cn(
        "z-drawer border-border bg-surface text-text shadow-float flex flex-col overflow-hidden border",
        placement === "map"
          ? "w-drawer absolute top-3 right-3 bottom-3 max-w-full rounded-lg"
          : "md:w-drawer pointer-events-auto absolute inset-x-0 top-1/4 bottom-0 rounded-t-lg md:inset-x-auto md:top-3 md:right-3 md:bottom-3 md:max-w-full md:rounded-lg",
        className,
      )}
    >
      <div className="h-topbar border-border flex shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2
            id={titleId}
            className={cn(
              "text-md text-text truncate font-medium",
              titleClassName ?? "font-mono",
            )}
          >
            {title}
          </h2>
          {headerAside}
        </div>
        <IconButton
          ref={setCloseRef}
          label={resolvedCloseLabel}
          icon={<X aria-hidden="true" className="size-4" strokeWidth={1.5} />}
          onClick={onClose}
        />
      </div>
      {actions ? (
        <div className="border-border flex shrink-0 flex-wrap items-center gap-1 border-b px-3 py-2">
          {actions}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );

  return placement === "page" ? <ContentPortal>{panel}</ContentPortal> : panel;
}

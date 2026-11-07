import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./IconButton";
import { cn } from "./cn";

export interface DrawerProps {
  open: boolean;
  /** Accessible name, e.g. "Vehicle details for LSD-100-AA". */
  label: string;
  title: string;
  headerAside?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  /** Called when the panel leaves the screen so focus can return to its origin. */
  returnFocus?: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Non-modal right panel. The map stays interactive, so focus is not trapped;
 * Escape and focus return are handled explicitly. Modals stay in Dialog.
 */
export function Drawer({
  open,
  label,
  title,
  headerAside,
  actions,
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
      if (active instanceof HTMLElement && active.closest('[role="dialog"]')) return;
      if (!(active instanceof Node) || !panelRef.current?.contains(active)) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      aria-label={label}
      aria-labelledby={label ? undefined : titleId}
      data-testid="drawer"
      className={cn(
        "absolute bottom-3 right-3 top-3 z-30 flex w-drawer max-w-full flex-col overflow-hidden rounded-lg border border-border bg-surface text-text shadow-float",
        className,
      )}
    >
      <div className="flex h-topbar shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id={titleId} className="truncate font-mono text-md font-medium text-text">
            {title}
          </h2>
          {headerAside}
        </div>
        <IconButton
          ref={closeRef}
          label="Close vehicle details"
          icon={<X aria-hidden="true" className="size-4" strokeWidth={1.5} />}
          onClick={onClose}
        />
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-3 py-2">
          {actions}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

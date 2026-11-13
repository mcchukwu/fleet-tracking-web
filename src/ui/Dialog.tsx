import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./cn";
import { IconButton } from "./IconButton";
import { isPortalledPopoverTarget, LayerPortal } from "./LayerPortal";

export type DialogVariant = "default" | "confirm" | "blocking";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: DialogVariant;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  variant = "default",
  footer,
  children,
  className,
}: DialogProps) {
  const blocking = variant === "blocking";
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      if (!restoreRef.current) {
        restoreRef.current = document.activeElement as HTMLElement | null;
      }
      return;
    }
    const target = restoreRef.current;
    restoreRef.current = null;
    if (target && document.contains(target)) target.focus();
  }, [open]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!blocking) onOpenChange(next);
      }}
    >
      <LayerPortal layer="dialog">
        <DialogPrimitive.Overlay className="animate-fade-in bg-overlay fixed inset-0" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(event) => {
            if (blocking) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (blocking || isPortalledPopoverTarget(event.target)) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (blocking || isPortalledPopoverTarget(event.target)) {
              event.preventDefault();
            }
          }}
          className={cn(
            "max-w-dialog animate-fade-in border-border bg-surface text-text shadow-float fixed top-1/2 left-1/2 w-11/12 -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <DialogPrimitive.Title className="text-md text-text font-medium">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-muted text-sm">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            {blocking ? null : (
              <DialogPrimitive.Close asChild>
                <IconButton
                  label="Close dialog"
                  icon={<X aria-hidden="true" className="size-4" strokeWidth={1.5} />}
                />
              </DialogPrimitive.Close>
            )}
          </div>
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? (
            <div data-dialog-footer className="mt-6 flex justify-end gap-2">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </LayerPortal>
    </DialogPrimitive.Root>
  );
}

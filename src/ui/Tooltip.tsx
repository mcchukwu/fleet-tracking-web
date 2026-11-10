import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { LayerPortal } from "./LayerPortal";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={0}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function Tooltip({
  label,
  children,
  side = "bottom",
  className,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <LayerPortal layer="tooltip">
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "max-w-panel animate-fade-in border-border bg-surface text-text shadow-menu pointer-events-none rounded-md border px-2 py-1 text-xs",
            className,
          )}
        >
          {label}
        </TooltipPrimitive.Content>
      </LayerPortal>
    </TooltipPrimitive.Root>
  );
}

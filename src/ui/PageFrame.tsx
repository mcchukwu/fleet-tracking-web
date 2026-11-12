import type { ReactNode } from "react";
import { cn } from "./cn";

export interface PageFrameProps {
  /** `fill` owns no page scroll; `scroll` owns the one content scroller. */
  layout: "fill" | "scroll";
  width?: "content" | "full";
  align?: "start" | "center";
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

/**
 * The one frame every route renders inside the shell's content area. A fill
 * frame clips its content and leaves scrolling to designated inner regions; a
 * scroll frame is the only page scroller and owns the single bottom inset.
 */
export function PageFrame({
  layout,
  width = "content",
  align = "start",
  className,
  contentClassName,
  children,
}: PageFrameProps) {
  const fill = layout === "fill";

  return (
    <div
      data-page-frame={layout}
      className={cn(
        "flex h-full min-h-0 w-full flex-col",
        fill ? "overflow-hidden" : "overflow-y-auto overscroll-contain",
        className,
      )}
    >
      <div
        data-page-frame-content
        className={cn(
          "flex min-h-0 w-full flex-col",
          fill ? "flex-1" : "page-frame-end",
          width === "content" && "max-w-content mx-auto",
          align === "center" && "min-h-full justify-center",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

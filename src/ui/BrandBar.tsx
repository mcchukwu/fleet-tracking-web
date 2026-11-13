import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type BrandBarProps = HTMLAttributes<HTMLDivElement>;

export function BrandBar({ className, ...props }: BrandBarProps) {
  return <div className={cn("h-topbar flex shrink-0 items-center px-4", className)} {...props} />;
}

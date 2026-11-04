import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-touch items-center gap-1 border-b border-border md:h-control-lg",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative inline-flex h-touch items-center px-3 text-sm text-muted md:h-control-lg transition-colors duration-100 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent after:content-[''] hover:text-text focus-visible:outline-2 focus-visible:outline-focus-ring data-[state=active]:text-text data-[state=active]:after:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("pt-3 focus-visible:outline-2 focus-visible:outline-focus-ring", className)}
      {...props}
    />
  );
}

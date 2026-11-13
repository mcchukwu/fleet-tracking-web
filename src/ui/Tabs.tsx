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
        "h-touch border-border md:h-control-lg inline-flex items-center gap-1 border-b",
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
        "h-touch text-muted md:h-control-lg hover:text-text focus-visible:outline-focus-ring data-[state=active]:text-text data-[state=active]:after:bg-accent relative inline-flex items-center px-3 text-sm transition-colors duration-100 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent after:content-[''] focus-visible:outline-2",
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
      className={cn("focus-visible:outline-focus-ring pt-3 focus-visible:outline-2", className)}
      {...props}
    />
  );
}

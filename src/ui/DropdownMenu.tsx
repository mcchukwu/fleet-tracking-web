import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";
import { LayerPortal } from "./LayerPortal";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const itemStyles =
  "flex min-h-touch shrink-0 select-none items-center gap-2 rounded-sm px-2 text-sm text-text outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 data-[state=checked]:bg-accent-soft md:min-h-control-md";

function ItemIndicator() {
  return (
    <DropdownMenuPrimitive.ItemIndicator
      data-testid="menu-item-indicator"
      className="text-accent-fg ml-auto flex size-4 shrink-0 items-center justify-center"
    >
      <Check aria-hidden="true" className="size-4" strokeWidth={2} />
    </DropdownMenuPrimitive.ItemIndicator>
  );
}

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) {
  return (
    <LayerPortal layer="popover">
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "animate-fade-in border-border bg-surface shadow-menu min-w-40 rounded-md border p-1",
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </LayerPortal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(itemStyles, className)}
      {...props}
    />
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  showIndicator = true,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & {
  showIndicator?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(itemStyles, className)}
      {...props}
    >
      {children}
      {showIndicator ? <ItemIndicator /> : null}
    </DropdownMenuPrimitive.RadioItem>
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  showIndicator = true,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem> & {
  showIndicator?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(itemStyles, className)}
      {...props}
    >
      {children}
      {showIndicator ? <ItemIndicator /> : null}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuLabel({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("text-muted px-2 py-1 text-xs", className)}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.Label>
  );
}

export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(itemStyles, "data-[state=open]:bg-surface-2", className)}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <LayerPortal layer="popover">
      <DropdownMenuPrimitive.SubContent
        className={cn(
          "animate-fade-in border-border bg-surface shadow-menu min-w-40 rounded-md border p-1",
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.SubContent>
    </LayerPortal>
  );
}

export function DropdownMenuSeparator({
  className,
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("bg-border my-1 h-px", className)}
    />
  );
}

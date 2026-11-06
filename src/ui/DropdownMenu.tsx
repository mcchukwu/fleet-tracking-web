import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const itemStyles =
  "flex h-touch select-none items-center gap-2 rounded-sm px-2 text-sm text-text outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 data-[state=checked]:bg-accent-soft md:h-control-md";

function ItemIndicator() {
  return (
    <DropdownMenuPrimitive.ItemIndicator
      data-testid="menu-item-indicator"
      className="ml-auto flex size-4 shrink-0 items-center justify-center text-accent-fg"
    >
      <Check aria-hidden="true" className="size-4" strokeWidth={2} />
    </DropdownMenuPrimitive.ItemIndicator>
  );
}

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  container,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
  container?: HTMLElement | null;
}) {
  return (
    <DropdownMenuPrimitive.Portal container={container ?? undefined}>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-menu min-w-40 animate-fade-in rounded-md border border-border bg-surface p-1 shadow-menu",
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>) {
  return <DropdownMenuPrimitive.Item className={cn(itemStyles, className)} {...props} />;
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
    <DropdownMenuPrimitive.RadioItem className={cn(itemStyles, className)} {...props}>
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
    <DropdownMenuPrimitive.CheckboxItem className={cn(itemStyles, className)} {...props}>
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
      className={cn("px-2 py-1 text-xs text-muted", className)}
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
  container,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent> & {
  container?: HTMLElement | null;
}) {
  return (
    <DropdownMenuPrimitive.Portal container={container ?? undefined}>
      <DropdownMenuPrimitive.SubContent
        className={cn(
          "z-menu min-w-40 animate-fade-in rounded-md border border-border bg-surface p-1 shadow-menu",
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.SubContent>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuSeparator({
  className,
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className={cn("my-1 h-px bg-border", className)} />;
}

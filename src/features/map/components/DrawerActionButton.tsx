import type { ReactNode } from "react";
import { Tooltip } from "../../../ui/Tooltip";
import { cn } from "../../../ui/cn";

export interface DrawerActionButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabledReason?: string;
  iconOnly?: boolean;
  /** Accessible name when the visible label is hidden in the icon variant. */
  accessibleName?: string;
  className?: string;
}

/**
 * Disabled by role or by an unavailable action stays focusable and announces
 * why; it is never hidden. A click does nothing while disabled.
 */
export function DrawerActionButton({
  label,
  icon,
  onClick,
  disabledReason,
  iconOnly = false,
  accessibleName,
  className,
}: DrawerActionButtonProps) {
  const disabled = Boolean(disabledReason);
  const button = (
    <button
      type="button"
      aria-disabled={disabled || undefined}
      aria-label={iconOnly ? (accessibleName ?? label) : undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
      className={cn(
        "inline-flex h-touch items-center justify-center gap-1 rounded-md px-2 text-sm font-medium transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring md:h-control-sm",
        iconOnly ? "w-touch px-0 md:w-control-sm" : undefined,
        disabled
          ? "cursor-not-allowed text-subtle opacity-60"
          : "text-text hover:bg-surface-2",
        className,
      )}
    >
      <span aria-hidden="true" className="inline-flex shrink-0 items-center">
        {icon}
      </span>
      {iconOnly ? null : <span>{label}</span>}
    </button>
  );

  return disabled ? <Tooltip label={disabledReason ?? label}>{button}</Tooltip> : button;
}

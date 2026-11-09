import { Check } from "lucide-react";
import type { Alert } from "../../../api/types";
import { Spinner } from "../../../ui/Spinner";
import { Tooltip } from "../../../ui/Tooltip";
import { cn } from "../../../ui/cn";

export interface AlertAckButtonProps {
  alert: Alert;
  pending: boolean;
  disabledReason?: string;
  onAck: () => void;
  iconOnly?: boolean;
  className?: string;
}

/**
 * A disabled action is never hidden: it stays focusable, explains why, and a
 * click does nothing. Pending keeps the action slot and blocks a second write.
 */
export function AlertAckButton({
  alert,
  pending,
  disabledReason,
  onAck,
  iconOnly = false,
  className,
}: AlertAckButtonProps) {
  const disabled = Boolean(disabledReason);
  const accessibleName = `Acknowledge alert for ${alert.plate}`;
  const button = (
    <button
      type="button"
      aria-label={accessibleName}
      aria-disabled={disabled || undefined}
      aria-busy={pending || undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled || pending) return;
        onAck();
      }}
      className={cn(
        "h-touch focus-visible:outline-focus-ring md:h-control-sm -my-2 inline-flex items-center justify-center gap-1 rounded-md px-2 text-sm font-medium transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-0 md:my-0",
        iconOnly ? "w-touch md:w-control-sm px-0" : undefined,
        disabled
          ? "text-subtle cursor-not-allowed opacity-60"
          : "text-text hover:bg-surface-2",
        className,
      )}
    >
      {pending ? (
        <Spinner />
      ) : (
        <Check aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />
      )}
      {iconOnly ? null : <span>Acknowledge</span>}
    </button>
  );

  if (!disabled) return button;
  return <Tooltip label={disabledReason ?? "Acknowledge"}>{button}</Tooltip>;
}

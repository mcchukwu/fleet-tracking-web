import { CircleAlert, Info, TriangleAlert, WifiOff, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { IconButton } from "./IconButton";

export type BannerTone = "neutral" | "warning" | "danger" | "info";

const toneStyles: Record<BannerTone, string> = {
  neutral: "border-border bg-surface-2 text-text",
  warning: "border-idle bg-idle-bg text-idle-fg",
  danger: "border-alert bg-alert-bg text-alert-fg",
  info: "border-accent bg-accent-soft text-accent-fg",
};

const toneIcons: Record<BannerTone, typeof Info> = {
  neutral: WifiOff,
  warning: TriangleAlert,
  danger: CircleAlert,
  info: Info,
};

export interface BannerProps {
  tone?: BannerTone;
  message: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function Banner({
  tone = "neutral",
  message,
  icon,
  action,
  dismissible = false,
  onDismiss,
  className,
}: BannerProps) {
  const Icon = toneIcons[tone];

  return (
    <output
      aria-live="polite"
      className={cn(
        "z-banner flex min-h-8 w-full items-center gap-2 border-b px-4 py-1 text-xs",
        toneStyles[tone],
        className,
      )}
    >
      {icon ?? <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} />}
      <p className="min-w-0 flex-1">{message}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="h-control-sm shrink-0 rounded-md px-2 font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
        >
          {action.label}
        </button>
      ) : null}
      {dismissible ? (
        <IconButton
          label="Dismiss"
          size="sm"
          onClick={onDismiss}
          icon={<X aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />}
        />
      ) : null}
    </output>
  );
}

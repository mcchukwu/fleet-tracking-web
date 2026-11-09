import { cva, type VariantProps } from "class-variance-authority";
import {
  Check,
  ChevronRight,
  Circle,
  Info,
  OctagonAlert,
  TriangleAlert,
} from "lucide-react";
import { cn } from "./cn";

const statusPill = cva(
  "inline-flex h-status items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium",
  {
    variants: {
      status: {
        moving: "bg-moving-bg text-moving-fg",
        idle: "bg-idle-bg text-idle-fg",
        offline: "bg-offline-bg text-offline-fg",
        alert: "bg-alert-bg text-alert-fg",
      },
    },
  },
);

export type VehicleStatus = "moving" | "idle" | "offline" | "alert";

export type ConnectionState = "live" | "online" | "reconnecting" | "offline";

const connectionLabel: Record<ConnectionState, string> = {
  live: "Live",
  online: "Online",
  reconnecting: "Reconnecting…",
  offline: "Offline",
};

const connectionDot: Record<ConnectionState, string> = {
  live: "bg-moving",
  online: "bg-moving",
  reconnecting: "bg-idle",
  offline: "bg-offline",
};

export function ConnectionIndicator({
  state,
  compact = false,
}: {
  state: ConnectionState;
  compact?: boolean;
}) {
  return (
    <output
      aria-label={`Connection: ${connectionLabel[state]}`}
      className="text-text inline-flex items-center gap-2 text-xs font-medium"
    >
      <span aria-hidden="true" className="relative flex size-2">
        {state === "live" ? (
          <span className="bg-moving absolute inline-flex size-2 animate-ping rounded-full opacity-60 motion-reduce:animate-none" />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            connectionDot[state],
          )}
        />
      </span>
      <span className={compact ? "hidden md:inline" : undefined}>
        {connectionLabel[state]}
      </span>
    </output>
  );
}

const statusLabel: Record<VehicleStatus, string> = {
  moving: "Moving",
  idle: "Idle",
  offline: "Offline",
  alert: "Alert",
};

function StatusGlyph({ status }: { status: VehicleStatus }) {
  if (status === "moving") {
    return (
      <span
        aria-hidden="true"
        className="relative inline-flex size-3 items-center justify-center"
      >
        <Circle className="absolute size-3 fill-current" strokeWidth={0} />
        <ChevronRight
          className="text-text-inverse relative size-2"
          strokeWidth={3}
        />
      </span>
    );
  }

  if (status === "alert") {
    return (
      <span
        aria-hidden="true"
        className="relative inline-flex size-3 items-center justify-center"
      >
        <Circle className="absolute size-3 fill-current" strokeWidth={0} />
        <span className="status-alert-mark text-text-inverse relative">!</span>
        <span className="absolute size-3 rounded-full ring-1 ring-current" />
      </span>
    );
  }

  return (
    <Circle
      aria-hidden="true"
      className={cn("size-3", status === "idle" ? "fill-current" : "")}
      strokeWidth={status === "offline" ? 2 : 0}
    />
  );
}

export function StatusPill({
  status,
  className,
}: {
  status: VehicleStatus;
  className?: string;
}) {
  return (
    <span className={cn(statusPill({ status }), className)}>
      <StatusGlyph status={status} />
      {statusLabel[status]}
    </span>
  );
}

const severityBadge = cva(
  "inline-flex h-status items-center gap-1 whitespace-nowrap rounded-sm px-2 text-xs font-medium",
  {
    variants: {
      level: {
        low: "text-sev-low",
        medium: "text-sev-medium",
        high: "text-sev-high",
        critical: "text-sev-critical",
      },
    },
  },
);

export type Severity = "low" | "medium" | "high" | "critical";

const severityIcon: Record<Severity, typeof Info> = {
  low: Info,
  medium: TriangleAlert,
  high: OctagonAlert,
  critical: OctagonAlert,
};

export function SeverityBadge({
  level,
  className,
}: {
  level: Severity;
  className?: string;
}) {
  const Icon = severityIcon[level];
  return (
    <span className={cn(severityBadge({ level }), className)}>
      <Icon aria-hidden="true" className="size-3" strokeWidth={1.5} />
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

export type AlertStatus = "open" | "acked" | "closed";

const alertStatusClasses: Record<AlertStatus, string> = {
  open: "border border-alert-fg text-alert-fg",
  acked: "bg-surface-2 text-muted",
  closed: "text-subtle",
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return (
    <span
      className={cn(
        "h-status inline-flex items-center gap-1 rounded-sm px-2 text-xs font-medium whitespace-nowrap",
        alertStatusClasses[status],
      )}
    >
      {status === "acked" ? (
        <Check aria-hidden="true" className="size-3" strokeWidth={1.5} />
      ) : null}
      {status === "open"
        ? "Open"
        : status === "acked"
          ? "Acknowledged"
          : "Closed"}
    </span>
  );
}

export type TripStatus =
  "planned" | "assigned" | "active" | "completed" | "cancelled";

const tripStatusClasses: Record<TripStatus, string> = {
  planned: "bg-surface-2 text-muted",
  assigned: "border border-border-strong text-text",
  active: "bg-accent-soft text-accent-fg",
  completed: "bg-moving-bg text-moving-fg",
  cancelled: "text-subtle",
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return (
    <span
      className={cn(
        "h-status inline-flex items-center rounded-sm px-2 text-xs font-medium whitespace-nowrap",
        tripStatusClasses[status],
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

const badge = cva(
  "inline-flex h-status items-center whitespace-nowrap rounded-sm px-2 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-muted",
        accent: "bg-accent-soft text-accent-fg",
        success: "bg-moving-bg text-moving-fg",
        warning: "bg-idle-bg text-idle-fg",
        danger: "bg-alert-bg text-alert-fg",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends VariantProps<typeof badge> {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ tone, children, className }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)}>{children}</span>;
}

import type { Alert } from "../../../api/types";
import {
  alertTypeLabel,
  isAlertSeverity,
  isAlertStatus,
} from "../../../lib/status";
import {
  MISSING,
  formatRelativeTime,
  formatTimeTooltip,
} from "../../../lib/format";
import { useNow } from "../../../lib/ticker";
import { AlertStatusBadge, Badge, SeverityBadge } from "../../../ui/Badge";
import { CopyButton } from "../../../ui/CopyButton";
import { TD, TR } from "../../../ui/Table";
import { cn } from "../../../ui/cn";
import { AlertAckButton } from "./AlertAckButton";

export interface AlertRowProps {
  alert: Alert;
  zoneLabel: string | null;
  tripLabel: string | null;
  onOpen: () => void;
  onAck: () => void;
  pending: boolean;
  disabledReason?: string;
  highlighted: boolean;
}

export function AlertRow({
  alert,
  zoneLabel,
  tripLabel,
  onOpen,
  onAck,
  pending,
  disabledReason,
  highlighted,
}: AlertRowProps) {
  const now = useNow();
  const timeTooltip = formatTimeTooltip(alert.occurred_at);

  return (
    <TR
      selected={highlighted}
      className={cn("cursor-pointer", highlighted && "value-flash")}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a")) return;
        onOpen();
      }}
    >
      <TD>
        <button
          type="button"
          data-alert-row
          data-alert-id={alert.id}
          aria-label={`Open alert for ${alert.plate}, ${timeTooltip}`}
          title={timeTooltip}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key !== "a") return;
            event.preventDefault();
            if (!disabledReason && !pending) onAck();
          }}
          className="-my-2 inline-flex h-touch items-center rounded-sm text-xs tabular-nums text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring md:my-0 md:h-auto"
        >
          <time dateTime={alert.occurred_at}>{formatRelativeTime(alert.occurred_at, now)}</time>
        </button>
      </TD>

      <TD>
        <CopyButton inline value={alert.plate} label="plate" className="text-xs" />
      </TD>

      <TD>
        <span className="block text-sm text-text">{alertTypeLabel(alert.type)}</span>
        <span className="mt-1 block md:hidden">
          {isAlertSeverity(alert.severity) ? (
            <SeverityBadge level={alert.severity} />
          ) : (
            <Badge tone="neutral">Unknown severity: {alert.severity}</Badge>
          )}
        </span>
      </TD>

      <TD className="hidden md:table-cell">
        {isAlertSeverity(alert.severity) ? (
          <SeverityBadge level={alert.severity} />
        ) : (
          <Badge tone="neutral">Unknown severity: {alert.severity}</Badge>
        )}
      </TD>

      <TD>
        {isAlertStatus(alert.status) ? (
          <AlertStatusBadge status={alert.status} />
        ) : (
          <Badge tone="neutral">Unknown status: {alert.status}</Badge>
        )}
      </TD>

      <TD className="hidden lg:table-cell">
        <span className="text-xs text-muted">{zoneLabel ?? MISSING}</span>
      </TD>

      <TD className="hidden lg:table-cell">
        {tripLabel ? (
          <span className="font-mono text-xs text-muted">{tripLabel}</span>
        ) : (
          <span className="text-xs text-muted">{MISSING}</span>
        )}
      </TD>

      <TD className="text-right">
        <AlertAckButton
          alert={alert}
          pending={pending}
          disabledReason={disabledReason}
          onAck={onAck}
        />
      </TD>
    </TR>
  );
}

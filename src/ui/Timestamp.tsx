import { formatRelativeTime, formatTimeTooltip } from "../lib/format";
import { useNow } from "../lib/ticker";
import { cn } from "./cn";
import { Tooltip } from "./Tooltip";

export interface TimestampProps {
  iso: string;
  now?: number;
  className?: string;
}

export function Timestamp({ iso, now, className }: TimestampProps) {
  const tick = useNow();
  const relative = formatRelativeTime(iso, now ?? tick);
  return (
    <Tooltip label={formatTimeTooltip(iso)}>
      <time dateTime={iso} className={cn("tabular-nums", className)}>
        {relative}
      </time>
    </Tooltip>
  );
}

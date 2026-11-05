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
      <button
        type="button"
        className={cn(
          "pointer-events-auto -my-3 inline-flex h-touch min-w-touch items-center justify-center rounded-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring md:my-0 md:h-auto md:min-w-0",
          className,
        )}
      >
        <time dateTime={iso}>{relative}</time>
      </button>
    </Tooltip>
  );
}

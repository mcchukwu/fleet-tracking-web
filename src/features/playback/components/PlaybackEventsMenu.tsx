import { CalendarClock } from "lucide-react";
import { formatPlaybackTime } from "../../../lib/format";
import { Button } from "../../../ui/Button";
import { SeverityBadge } from "../../../ui/Badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../ui/DropdownMenu";
import { Tooltip } from "../../../ui/Tooltip";
import type { PlaybackEvent } from "../lib/events";

export interface PlaybackEventsMenuProps {
  events: readonly PlaybackEvent[];
  onJump: (timeMs: number) => void;
  includeDate?: boolean;
  disabledReason?: string;
}

const triggerClassName = "w-touch justify-center px-0 md:w-auto md:px-3";

export function PlaybackEventsMenu({
  events,
  onJump,
  includeDate = false,
  disabledReason = "No events in this range.",
}: PlaybackEventsMenuProps) {
  const count = events.length;
  const label = `Events (${count})`;
  const trigger = (
    <>
      <CalendarClock aria-hidden="true" className="size-4" strokeWidth={1.5} />
      <span className="hidden md:inline">{label}</span>
    </>
  );

  if (count === 0) {
    return (
      <Tooltip label={disabledReason}>
        <Button
          size="md"
          variant="ghost"
          disabled
          aria-disabled="true"
          aria-label={label}
          title={disabledReason}
          className={triggerClassName}
        >
          {trigger}
        </Button>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip label={label}>
        <DropdownMenuTrigger asChild>
          <Button size="md" variant="ghost" aria-label={label} className={triggerClassName}>
            {trigger}
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        collisionPadding={12}
        className="w-events-menu max-h-menu flex flex-col gap-0.5 overflow-y-auto"
      >
        {events.map((event) => (
          <DropdownMenuItem
            key={event.key}
            onSelect={() => onJump(event.atMs)}
            className="flex-col items-start gap-1 px-3 py-2"
          >
            <span className="flex w-full items-center gap-2">
              <span className="flex-1">{event.label}</span>
              {event.severity ? <SeverityBadge level={event.severity} /> : null}
            </span>
            <span className="text-muted text-xs tabular-nums">
              {formatPlaybackTime(event.at, includeDate)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { formatPlaybackTime } from "../../../lib/format";
import { Button } from "../../../ui/Button";
import { SeverityBadge } from "../../../ui/Badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../ui/DropdownMenu";
import type { PlaybackEvent } from "../lib/events";

export interface PlaybackEventsMenuProps {
  events: readonly PlaybackEvent[];
  onJump: (timeMs: number) => void;
  includeDate?: boolean;
  disabledReason?: string;
}

export function PlaybackEventsMenu({
  events,
  onJump,
  includeDate = false,
  disabledReason = "No events in this range.",
}: PlaybackEventsMenuProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-start">
        <Button
          size="md"
          variant="ghost"
          disabled
          aria-disabled="true"
          className="shrink-0 px-2 text-xs md:px-3"
        >
          Events (0)
        </Button>
        <span className="px-2 text-xs text-muted md:px-3">{disabledReason}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="md" variant="ghost" className="shrink-0 px-2 text-xs md:px-3">
          Events ({events.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="flex max-h-menu w-80 flex-col gap-0.5 overflow-y-auto"
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
            <span className="text-xs tabular-nums text-muted">
              {formatPlaybackTime(event.at, includeDate)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
  disabledReason?: string;
}

export function PlaybackEventsMenu({
  events,
  onJump,
  disabledReason = "No events in this range.",
}: PlaybackEventsMenuProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button size="sm" variant="ghost" disabled aria-disabled="true">
          Events (0)
        </Button>
        <span className="text-xs text-muted">{disabledReason}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost">
          Events ({events.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-64 w-72 overflow-y-auto">
        {events.map((event) => (
          <DropdownMenuItem
            key={event.key}
            onSelect={() => onJump(event.atMs)}
            className="flex flex-col items-start gap-1"
          >
            <span className="flex w-full items-center gap-2">
              <span className="flex-1">{event.label}</span>
              {event.severity ? <SeverityBadge level={event.severity} /> : null}
            </span>
            <span className="text-xs tabular-nums text-muted">
              {formatPlaybackTime(event.at)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

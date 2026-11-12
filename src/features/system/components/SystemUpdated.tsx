import { formatTimeTooltip } from "../../../lib/format";
import { Button } from "../../../ui/Button";
import { Tooltip } from "../../../ui/Tooltip";
import { updatedLabel } from "../lib/health";

export interface SystemUpdatedProps {
  at: number;
  now: number;
  online: boolean;
  fetching: boolean;
  showRefresh: boolean;
  onRefresh: () => void;
}

export function SystemUpdated({
  at,
  now,
  online,
  fetching,
  showRefresh,
  onRefresh,
}: SystemUpdatedProps) {
  if (!Number.isFinite(at) || at <= 0) return null;
  const iso = new Date(at).toISOString();

  return (
    <div className="flex items-center gap-2" data-health-updated>
      <Tooltip label={formatTimeTooltip(iso)}>
        <button
          type="button"
          className="text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring inline-flex h-touch items-center rounded-sm text-xs md:h-control-sm"
        >
          <time dateTime={iso} className="tabular-nums">
            {updatedLabel(at, now)}
          </time>
        </button>
      </Tooltip>
      {showRefresh ? (
        <Button
          size="sm"
          variant="ghost"
          loading={fetching}
          {...(online ? {} : { disabledReason: "You're offline." })}
          onClick={onRefresh}
        >
          Refresh
        </Button>
      ) : null}
    </div>
  );
}

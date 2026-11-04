import { cn } from "../../../ui/cn";
import { Spinner } from "../../../ui/Spinner";
import { Stat } from "../../../ui/Stat";

export interface KpiCell {
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
  error?: boolean;
  onRetry?: () => void;
}

export interface KpiStripProps {
  cells: readonly KpiCell[];
  compact?: boolean;
  loading?: boolean;
  className?: string;
}

export function KpiStrip({ cells, compact = false, loading = false, className }: KpiStripProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface shadow-float",
        compact ? "grid grid-cols-2 gap-px" : "flex",
        className,
      )}
      aria-label="Fleet summary"
      aria-busy={loading || undefined}
    >
      {cells.map((cell) => {
        const content = (
          <Stat
            label={cell.label}
            value={cell.value}
            {...(cell.hint ? { hint: cell.hint } : {})}
            size={compact ? "sm" : "md"}
            className={cn(
              compact ? "border-l-0" : undefined,
              cell.onClick ? "h-full w-full text-left" : undefined,
            )}
          />
        );

        return (
          <div key={cell.label} className="relative min-w-0">
            {cell.onClick ? (
              <button
                type="button"
                onClick={cell.onClick}
                className="block h-full w-full rounded-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
              >
                {content}
              </button>
            ) : (
              content
            )}
            {cell.error && cell.onRetry ? (
              <button
                type="button"
                onClick={cell.onRetry}
                className="absolute inset-x-0 bottom-0 flex h-touch items-center justify-center gap-1 text-xs font-medium text-accent-fg md:h-6"
              >
                {loading ? <Spinner /> : null}
                Retry
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

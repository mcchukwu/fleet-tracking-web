import { Skeleton } from "../../../ui/StatePanel";
import { cn } from "../../../ui/cn";
import { HEALTH_GROUP_COLUMNS, HEALTH_GROUP_SPECS } from "../lib/constants";

const skeletonCells = {
  dependencies: { cells: 2, size: "md", hint: false },
  fleet: { cells: 4, size: "md", hint: true },
  ingest: { cells: 8, size: "sm", hint: true },
} as const;

function SkeletonCell({
  size,
  hint,
}: {
  size: "md" | "sm";
  hint: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-surface flex flex-col gap-1",
        size === "md" ? "min-h-24 px-4 py-4" : "min-h-20 px-3 py-2",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className={cn("w-12", size === "md" ? "h-8" : "h-7")} />
      {hint ? (
        <Skeleton className={size === "md" ? "h-5 w-16 md:h-4" : "h-4 w-16"} />
      ) : null}
    </div>
  );
}

export function SystemSkeleton() {
  return (
    <output
      aria-busy="true"
      aria-label="Loading system health"
      data-testid="system-skeleton"
      className="flex flex-col gap-6"
    >
      {HEALTH_GROUP_SPECS.map((spec) => {
        const cells = skeletonCells[spec.id];
        return (
          <section
            key={spec.id}
            data-health-group={spec.id}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-col gap-0.5">
              <h2 className="text-text text-sm font-semibold">{spec.title}</h2>
              <p className="text-muted text-xs">{spec.description}</p>
            </div>
            <div
              className={cn(
                "border-border bg-border grid gap-px overflow-hidden rounded-lg border",
                HEALTH_GROUP_COLUMNS[spec.columns],
              )}
            >
              {Array.from({ length: cells.cells }).map((_, index) => (
                <SkeletonCell key={index} size={cells.size} hint={cells.hint} />
              ))}
            </div>
          </section>
        );
      })}
    </output>
  );
}

import { Skeleton } from "../../../ui/StatePanel";
import { cn } from "../../../ui/cn";
import { HEALTH_GROUP_COLUMNS, HEALTH_GROUP_SPECS, type HealthGroupId } from "../lib/constants";

type SkeletonHint = "none" | "text" | "touch";

const skeletonCells: Record<HealthGroupId, { size: "md" | "sm"; hints: readonly SkeletonHint[] }> =
  {
    dependencies: { size: "md", hints: ["none", "none"] },
    fleet: { size: "md", hints: ["text", "none", "none", "touch"] },
    ingest: {
      size: "sm",
      hints: ["text", "text", "text", "text", "text", "text", "text", "text"],
    },
  };

function SkeletonCell({ size, hint }: { size: "md" | "sm"; hint: SkeletonHint }) {
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
      {hint === "text" ? <Skeleton className="h-4 w-16" /> : null}
      {hint === "touch" ? <Skeleton className="h-5 w-16 md:h-4" /> : null}
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
          <section key={spec.id} data-health-group={spec.id} className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <h2 className="text-text text-sm font-semibold">{spec.title}</h2>
              <p className="text-muted text-xs">{spec.description}</p>
            </div>
            <div
              className={cn(
                "border-border bg-border grid gap-px overflow-hidden rounded-lg border",
                HEALTH_GROUP_COLUMNS[spec.columns],
              )}
            >
              {cells.hints.map((hint, index) => (
                <SkeletonCell key={index} size={cells.size} hint={hint} />
              ))}
            </div>
          </section>
        );
      })}
    </output>
  );
}

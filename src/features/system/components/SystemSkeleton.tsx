import { Skeleton } from "../../../ui/StatePanel";
import { cn } from "../../../ui/cn";

function SkeletonGroup({
  titleWidth,
  cells,
  columns,
  cellClassName,
}: {
  titleWidth: string;
  cells: number;
  columns: string;
  cellClassName: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className={cn("h-4", titleWidth)} />
      <div
        className={cn(
          "border-border bg-border grid gap-px overflow-hidden rounded-lg border",
          columns,
        )}
      >
        {Array.from({ length: cells }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "bg-surface flex flex-col justify-center gap-2",
              cellClassName,
            )}
          >
            <Skeleton className="w-20" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
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
      <SkeletonGroup
        titleWidth="w-28"
        cells={2}
        columns="sm:grid-cols-2"
        cellClassName="min-h-24 px-4 py-4"
      />
      <SkeletonGroup
        titleWidth="w-16"
        cells={4}
        columns="sm:grid-cols-2 lg:grid-cols-4"
        cellClassName="min-h-24 px-4 py-4"
      />
      <SkeletonGroup
        titleWidth="w-20"
        cells={8}
        columns="sm:grid-cols-2 lg:grid-cols-4"
        cellClassName="min-h-20 px-3 py-2"
      />
    </output>
  );
}

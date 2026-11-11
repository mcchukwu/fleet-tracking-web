import { Skeleton } from "../../../ui/StatePanel";

export function ReportsSkeleton() {
  return (
    <output
      aria-busy="true"
      aria-label="Loading report"
      className="flex flex-col gap-6"
    >
      <div className="border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-3 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="bg-surface flex min-h-28 flex-col justify-center gap-2 px-4 py-4"
          >
            <Skeleton className="w-16" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>
      <div
        data-testid="reports-skeleton-chart"
        className="border-border bg-surface flex min-h-48 flex-col gap-3 rounded-lg border p-4"
      >
        <Skeleton className="h-6 w-28" />
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex h-5 items-center gap-3">
              <Skeleton className="w-32" />
              <Skeleton className="h-2 flex-1" />
              <Skeleton className="w-10" />
            </div>
          ))}
        </div>
        <div className="border-border border-t pt-2">
          <div className="flex min-h-touch items-center md:min-h-control-sm">
            <Skeleton className="w-32" />
          </div>
        </div>
      </div>
    </output>
  );
}

import { Skeleton } from "../../../ui/StatePanel";

export function ReportsSkeleton() {
  return (
    <output aria-busy="true" aria-label="Loading report" className="flex flex-col gap-6">
      <div className="border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-3 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="bg-surface flex min-h-28 flex-col justify-center gap-2 px-4 py-4">
            <Skeleton className="w-16" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>
      <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4">
        <Skeleton className="w-28" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="w-32" />
            <Skeleton className="h-2 flex-1" />
            <Skeleton className="w-10" />
          </div>
        ))}
      </div>
    </output>
  );
}

import { Skeleton } from "../../../ui/StatePanel";

export function ShellSkeleton() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-text">
      <output className="sr-only">Loading the console</output>
      <div className="flex h-topbar shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        <Skeleton className="size-control-sm" />
        <Skeleton className="h-3 w-28" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="hidden h-control-md w-panel max-w-full md:block" />
          <Skeleton className="size-control-md rounded-full" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-rail shrink-0 flex-col gap-2 border-r border-border bg-surface p-2 md:flex">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="size-control-lg" />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-4 p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-full max-w-prose" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

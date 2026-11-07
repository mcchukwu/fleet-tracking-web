import { Skeleton } from "../../../ui/StatePanel";

export function VehicleDrawerSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading vehicle details" className="space-y-6 p-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="w-2/3" />
        <Skeleton className="w-1/2" />
        <Skeleton className="w-3/4" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="w-2/3" />
        <Skeleton className="w-1/2" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="w-3/4" />
        <Skeleton className="w-1/2" />
      </div>
    </div>
  );
}

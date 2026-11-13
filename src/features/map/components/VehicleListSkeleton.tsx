import { Skeleton } from "../../../ui/StatePanel";
import { rowBoxStyle } from "./VehicleRow";

export interface VehicleListSkeletonProps {
  rows?: number;
  rowHeight: number;
}

export function VehicleListSkeleton({ rows = 6, rowHeight }: VehicleListSkeletonProps) {
  return (
    <output aria-busy="true" aria-label="Loading vehicles" className="flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          style={rowBoxStyle(rowHeight)}
          className="border-border flex flex-col justify-center gap-2 border-b px-3"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="w-14" />
            <Skeleton className="w-20" />
            <Skeleton className="ml-auto w-8" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-24" />
            <Skeleton className="ml-auto w-12" />
          </div>
        </div>
      ))}
    </output>
  );
}

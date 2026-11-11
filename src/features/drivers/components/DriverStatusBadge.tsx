import { Circle } from "lucide-react";
import { Badge } from "../../../ui/Badge";

/**
 * Administrative driver status, not the live vehicle status. Shape carries the
 * meaning as well as colour: filled for active, hollow for inactive.
 */
export function DriverStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge tone="success">
        <span className="inline-flex items-center gap-1">
          <Circle aria-hidden="true" className="size-3 fill-current" strokeWidth={0} />
          Active
        </span>
      </Badge>
    );
  }
  if (status === "inactive") {
    return (
      <Badge tone="neutral">
        <span className="inline-flex items-center gap-1">
          <Circle aria-hidden="true" className="size-3" strokeWidth={2} />
          Inactive
        </span>
      </Badge>
    );
  }
  return (
    <Badge tone="neutral">
      <span className="inline-flex items-center gap-1">
        <Circle aria-hidden="true" className="size-3" strokeWidth={2} />
        Unknown status: {status}
      </span>
    </Badge>
  );
}

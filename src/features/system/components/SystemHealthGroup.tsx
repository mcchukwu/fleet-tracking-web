import { cn } from "../../../ui/cn";
import {
  HEALTH_GROUP_COLUMNS,
  type HealthGroupId,
} from "../lib/constants";
import type { HealthItem } from "../lib/health";
import { SystemHealthItem } from "./SystemHealthItem";

export interface SystemHealthGroupProps {
  id: HealthGroupId;
  title: string;
  description?: string;
  items: readonly HealthItem[];
  columns: 2 | 4;
}

export function SystemHealthGroup({
  id,
  title,
  description,
  items,
  columns,
}: SystemHealthGroupProps) {
  const headingId = `health-${id}`;
  return (
    <section
      aria-labelledby={headingId}
      data-health-group={id}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id={headingId} className="text-text text-sm font-semibold">
          {title}
        </h2>
        {description ? <p className="text-muted text-xs">{description}</p> : null}
      </div>
      {items.length === 0 ? (
        <p className="border-border bg-surface text-muted rounded-lg border px-4 py-3 text-sm">
          {id === "dependencies"
            ? "No dependencies reported."
            : `No ${title.toLowerCase()} reported.`}
        </p>
      ) : (
        <ul
          className={cn(
            "border-border bg-border grid gap-px overflow-hidden rounded-lg border",
            HEALTH_GROUP_COLUMNS[columns],
          )}
        >
          {items.map((item) => (
            <SystemHealthItem
              key={item.id}
              item={item}
              size={id === "ingest" ? "sm" : "md"}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

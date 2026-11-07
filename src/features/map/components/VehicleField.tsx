import type { ReactNode } from "react";
import { cn } from "../../../ui/cn";

export function VehicleSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-border px-4 py-4 last:border-b-0", className)}>
      <h3 className="label-caps text-muted">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function VehicleField({
  label,
  children,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className={cn("min-w-0 text-right text-sm tabular-nums text-text", valueClassName)}>
        {children}
      </dd>
    </div>
  );
}

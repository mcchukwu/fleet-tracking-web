import type { HTMLAttributes, Ref, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./cn";

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border bg-surface", className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-surface-2">{children}</thead>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  className,
  selected = false,
  ref,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & {
  selected?: boolean;
  ref?: Ref<HTMLTableRowElement>;
}) {
  return (
    <tr
      ref={ref}
      aria-selected={selected || undefined}
      className={cn("h-row border-b border-l-2 border-l-transparent border-border transition-colors duration-100 last:border-0 hover:bg-surface-2", selected ? "border-l-accent bg-accent-soft" : "", className)}
      {...props}
    />
  );
}

export function TH({ className, numeric = false, children, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "label-caps sticky top-0 border-b border-border px-3 py-2 text-left text-muted",
        numeric ? "text-right" : "",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TD({ className, numeric = false, children, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td className={cn("px-3 text-text", numeric ? "text-right tabular-nums" : "", className)} {...props}>
      {children}
    </td>
  );
}

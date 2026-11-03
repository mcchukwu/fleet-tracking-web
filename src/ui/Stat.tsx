import { cn } from "./cn";

interface StatProps {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}

export function Stat({ label, value, hint, className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1 border-l border-border px-4 py-4 first:border-l-0", className)}>
      <span className="label-caps text-muted">{label}</span>
      <span className="text-stat text-text">{value}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

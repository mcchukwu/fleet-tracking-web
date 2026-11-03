import { Ban, Inbox } from "lucide-react";
import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("h-3 animate-pulse-soft rounded-sm bg-surface-2 motion-reduce:animate-none", className)} />;
}

export function LoadingBar({ label = "Loading" }: { label?: string }) {
  return (
    /* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <progress> cannot host the indeterminate bar. */
    <div role="progressbar" aria-label={label} className="h-0.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full w-1/3 animate-progress rounded-full bg-accent motion-reduce:animate-none" />
    </div>
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <output aria-busy="true" aria-label="Loading" className="flex flex-col gap-3 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="w-8" />
          <Skeleton className="w-1/4" />
          <Skeleton className="w-1/3" />
          <Skeleton className="ml-auto w-12" />
        </div>
      ))}
    </output>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <Inbox aria-hidden="true" className="size-6 text-subtle" strokeWidth={1.5} />
      <p className="text-base font-medium text-text">{title}</p>
      <p className="max-w-prose text-sm text-muted">{description}</p>
      {action}
    </div>
  );
}

export function ForbiddenState() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Ban aria-hidden="true" className="size-6 text-subtle" strokeWidth={1.5} />
      <p className="text-base font-medium text-text">You don't have access to this.</p>
      <p className="text-sm text-muted">Ask an administrator to review your role.</p>
    </div>
  );
}

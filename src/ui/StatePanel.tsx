import { Ban, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse-soft bg-surface-2 h-3 rounded-sm motion-reduce:animate-none",
        className,
      )}
    />
  );
}

// oxlint-disable jsx-a11y/prefer-tag-over-role -- <progress> cannot host the indeterminate bar.
export function LoadingBar({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      className="bg-surface-2 h-0.5 w-full overflow-hidden rounded-full"
    >
      <div className="animate-progress bg-accent h-full w-1/3 rounded-full motion-reduce:animate-none" />
    </div>
  );
}
// oxlint-enable jsx-a11y/prefer-tag-over-role

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
      <Inbox aria-hidden="true" className="text-subtle size-6" strokeWidth={1.5} />
      <p className="text-text text-base font-medium">{title}</p>
      <p className="text-muted max-w-prose text-sm">{description}</p>
      {action}
    </div>
  );
}

export function ForbiddenState({ action }: { action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Ban aria-hidden="true" className="text-subtle size-6" strokeWidth={1.5} />
      <p className="text-text text-base font-medium">You don't have access to this.</p>
      <p className="text-muted text-sm">Ask an administrator to review your role.</p>
      {action}
    </div>
  );
}

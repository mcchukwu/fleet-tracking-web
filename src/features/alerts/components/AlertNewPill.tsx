export interface AlertNewPillProps {
  count: number;
  onReveal: () => void;
}

/** A button, not a second live region: the global toast is the only announcer. */
export function AlertNewPill({ count, onReveal }: AlertNewPillProps) {
  if (count <= 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-map-controls flex justify-center">
      <button
        type="button"
        onClick={onReveal}
        className="h-touch border-border bg-surface text-accent-fg shadow-menu hover:bg-surface-2 focus-visible:outline-focus-ring md:h-control-md pointer-events-auto inline-flex items-center rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-0"
      >
        {count === 1 ? "1 new alert" : `${count} new alerts`}
      </button>
    </div>
  );
}

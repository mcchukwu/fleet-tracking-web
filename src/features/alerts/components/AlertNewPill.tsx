export interface AlertNewPillProps {
  count: number;
  onReveal: () => void;
}

/** A button, not a second live region: the global toast is the only announcer. */
export function AlertNewPill({ count, onReveal }: AlertNewPillProps) {
  if (count <= 0) return null;
  return (
    <div className="pointer-events-none sticky bottom-3 z-10 flex justify-center">
      <button
        type="button"
        onClick={onReveal}
        className="pointer-events-auto inline-flex h-touch items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-accent-fg shadow-menu hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring md:h-control-md"
      >
        {count === 1 ? "1 new alert" : `${count} new alerts`}
      </button>
    </div>
  );
}

import { Dialog } from "../../../ui/Dialog";
import { scopeLabels, shortcuts, type ShortcutScope } from "../shortcuts";

const scopes: readonly ShortcutScope[] = ["global", "map", "alerts", "playback"];

export interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Keyboard shortcuts"
      description="Shortcuts are disabled while you're typing in a field."
    >
      {/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- focusable so a keyboard user can scroll the list (axe scrollable-region-focusable) */}
      <section
        className="max-h-96 space-y-4 overflow-y-auto"
        tabIndex={0}
        aria-label="Shortcut list"
      >
        {scopes.map((scope) => {
          const items = shortcuts.filter((shortcut) => shortcut.scope === scope);
          if (items.length === 0) return null;
          return (
            <section key={scope} aria-labelledby={`shortcuts-${scope}`}>
              <h3 id={`shortcuts-${scope}`} className="label-caps text-muted">
                {scopeLabels[scope]}
              </h3>
              <dl className="mt-2 flex flex-col gap-1">
                {items.map((shortcut) => (
                  <div key={shortcut.id} className="flex items-center justify-between gap-4 py-1">
                    <dt className={shortcut.active ? "text-sm text-text" : "text-sm text-muted"}>
                      {shortcut.label}
                    </dt>
                    <dd className="flex shrink-0 items-center gap-1">
                      {shortcut.keys.map((key, index) => (
                        <span key={`${shortcut.id}-${key}`} className="flex items-center gap-1">
                          {index > 0 ? <span className="text-xs text-subtle">then</span> : null}
                          <kbd className="rounded-sm border border-border bg-surface-2 px-2 py-1 font-mono text-xs text-text">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </section>
      {/* oxlint-enable jsx-a11y/no-noninteractive-tabindex */}
    </Dialog>
  );
}

import { useEffect } from "react";
import { isEditable, isModalOpen } from "../../../lib/keyboard";
import { nextSelectionKey, type VehicleRow } from "../lib/filter";

export interface MapShortcutActions {
  rows: readonly VehicleRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onTogglePanel: () => void;
}

export function useMapShortcuts({
  rows,
  selectedKey,
  onSelect,
  onTogglePanel,
}: MapShortcutActions): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditable(event.target) || isModalOpen()) return;

      if (event.key === "j" || event.key === "k") {
        const next = nextSelectionKey(rows, selectedKey, event.key === "j" ? 1 : -1);
        if (next) {
          event.preventDefault();
          onSelect(next);
        }
        return;
      }

      if (event.key === "[") {
        event.preventDefault();
        onTogglePanel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSelect, onTogglePanel, rows, selectedKey]);
}

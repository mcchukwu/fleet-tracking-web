import { useEffect } from "react";
import { isEditable, isModalOpen } from "../../../lib/keyboard";

export interface PlaybackShortcutActions {
  onToggle: () => void;
  onStep: (direction: -1 | 1) => void;
  onSpeed: (direction: -1 | 1) => void;
}

function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.closest(
      'input, textarea, select, [role="slider"], [role="dialog"], [role="menu"], [role="combobox"], [role="listbox"]',
    ) !== null
  );
}

function activatesNatively(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest('button, a, [role="button"], [role="link"]') !== null;
}

export function usePlaybackShortcuts({
  onToggle,
  onStep,
  onSpeed,
}: PlaybackShortcutActions): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditable(event.target) || isInteractive(event.target) || isModalOpen()) return;

      if (event.key === " ") {
        if (activatesNatively(event.target)) return;
        event.preventDefault();
        onToggle();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onStep(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onStep(1);
        return;
      }
      if (event.key === ",") {
        event.preventDefault();
        onSpeed(-1);
        return;
      }
      if (event.key === ".") {
        event.preventDefault();
        onSpeed(1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onToggle, onStep, onSpeed]);
}

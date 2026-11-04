import { useEffect, useRef } from "react";
import type { NavPath } from "../nav";
import { chordTargets } from "../shortcuts";

const CHORD_TIMEOUT_MS = 1_000;

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function isModalOpen(): boolean {
  return document.querySelector('dialog[open], [role="dialog"], [role="menu"]') !== null;
}

function requestSearchFocus(): void {
  window.dispatchEvent(new CustomEvent("fleet:focus-search"));
}

export interface ShortcutActions {
  onOpenShortcuts: () => void;
  onNavigate: (path: NavPath) => void;
  onEscape: () => void;
}

export function useShortcuts({ onOpenShortcuts, onNavigate, onEscape }: ShortcutActions): void {
  const chord = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const clearChord = () => {
      chord.current = false;
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditable(event.target) || isModalOpen()) return;

      if (event.key === "Escape") {
        if (chord.current) {
          clearChord();
          return;
        }
        onEscape();
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        requestSearchFocus();
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        onOpenShortcuts();
        return;
      }

      if (chord.current) {
        const target = chordTargets[event.key.toLowerCase()];
        clearChord();
        if (target) {
          event.preventDefault();
          onNavigate(target as NavPath);
        }
        return;
      }

      if (event.key.toLowerCase() === "g") {
        chord.current = true;
        timer.current = window.setTimeout(clearChord, CHORD_TIMEOUT_MS);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearChord();
    };
  }, [onEscape, onNavigate, onOpenShortcuts]);
}

export { CHORD_TIMEOUT_MS, isEditable, isModalOpen };

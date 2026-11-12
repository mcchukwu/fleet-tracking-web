import type { BeforeInstallPromptEvent, InstallOutcome } from "./types";

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let listening = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function isStandalone(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function installAvailable(): boolean {
  return deferred !== null && !installed && !isStandalone();
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Captured before React renders, so the menu never misses the event. */
export function captureInstallPrompt(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * User-initiated only. A decline is not an error and is never retried; the
 * browser controls when the prompt can be shown again.
 */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferred;
  if (!event || installed) return "unavailable";

  deferred = null;
  emit();

  try {
    await event.prompt();
    const choice = await event.userChoice;
    void requestPersistentStorage();
    return choice.outcome;
  } catch {
    return "unavailable";
  }
}

/** Test seam: the captured event is module state. */
export function resetInstallPromptForTests(): void {
  deferred = null;
  installed = false;
}

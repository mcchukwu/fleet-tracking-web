export type ActivateUpdate = (reloadPage?: boolean) => Promise<void>;

let handler: ActivateUpdate | null = null;

export function setUpdateHandler(next: ActivateUpdate): void {
  handler = next;
}

export function clearUpdateHandler(): void {
  handler = null;
}

export function hasUpdateHandler(): boolean {
  return handler !== null;
}

/**
 * The banner's Reload action. When a waiting worker is registered it activates
 * it; otherwise the session is still refreshed by a plain reload.
 */
export function activateUpdate(reload: () => void = () => window.location.reload()): void {
  if (handler) {
    void handler(true);
    return;
  }
  reload();
}

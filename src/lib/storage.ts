export interface GuardedStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const memory = new Map<string, string>();

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage; // guard-ignore: chunk-loop guard only; no session or user data.
  } catch {
    return undefined;
  }
}

export function createGuardedStorage(storage: Storage | undefined = browserStorage()): GuardedStorage {
  return {
    get(key) {
      try {
        return storage ? storage.getItem(key) : (memory.get(key) ?? null);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    set(key, value) {
      memory.set(key, value);
      try {
        storage?.setItem(key, value);
      } catch {
        // Quota or private mode; the in-memory fallback keeps the guard working.
      }
    },
    remove(key) {
      memory.delete(key);
      try {
        storage?.removeItem(key);
      } catch {
        // Nothing to do when storage is unavailable.
      }
    },
  };
}

export const guardedStorage = createGuardedStorage();

const CHUNK_KEY = "fleet.chunk-reload-at";
const CHUNK_COOLDOWN_MS = 60_000;

export function claimChunkReload(now = Date.now()): boolean {
  const previous = Number(guardedStorage.get(CHUNK_KEY) ?? 0);
  if (Number.isFinite(previous) && now - previous < CHUNK_COOLDOWN_MS) return false;
  guardedStorage.set(CHUNK_KEY, String(now));
  return true;
}

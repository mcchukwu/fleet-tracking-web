import { onlineManager } from "@tanstack/react-query";
import { setPwaDebug } from "../dev/debug";

const CONTROLLER_TIMEOUT_MS = 10_000;

export interface WarmMapOptions {
  onFailure?: () => void;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  waitForController?: () => Promise<boolean>;
  isCached?: (url: string) => Promise<boolean>;
  now?: () => number;
}

let warming: Promise<boolean> | null = null;
let warmedFor: string | null = null;

/** iOS may evict the pack between sessions; the flag alone is not proof. */
async function hasCachedResponse(url: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    return (await caches.match(url)) !== undefined;
  } catch {
    return false;
  }
}

async function waitForServiceWorker(timeoutMs = CONTROLLER_TIMEOUT_MS): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  if (navigator.serviceWorker.controller) return true;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      resolve(value);
    };
    const onChange = () => {
      if (navigator.serviceWorker.controller) finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
  });
}

/**
 * Fetches the full PMTiles response once the worker controls the page, so a
 * later offline range request is served as a 206 from the cached full body.
 * Duplicate calls share one request; a failure is reported once and retried on
 * the next online map view.
 */
export async function warmMap(url: string, options: WarmMapOptions = {}): Promise<boolean> {
  if (url === "") return false;
  const cached = options.isCached ?? hasCachedResponse;
  if (warmedFor === url && (await cached(url))) return true;
  if (warming) return warming;
  if (!onlineManager.isOnline()) return false;
  if (options.signal?.aborted) return false;

  const wait = options.waitForController ?? (() => waitForServiceWorker());
  const fetchPack = options.fetcher ?? fetch;

  warming = (async () => {
    try {
      const controlled = await wait();
      if (!controlled || options.signal?.aborted) return false;

      const response = await fetchPack(url, {
        credentials: "omit",
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (!response.ok) throw new Error(`Map pack request failed with ${response.status}`);

      warmedFor = url;
      setPwaDebug({ mapCachedAt: (options.now ?? Date.now)() });
      return true;
    } catch {
      if (!options.signal?.aborted) options.onFailure?.();
      return false;
    } finally {
      warming = null;
    }
  })();

  return warming;
}

/** Test seam: warm-up state is process-wide. */
export function resetWarmMapForTests(): void {
  warming = null;
  warmedFor = null;
}

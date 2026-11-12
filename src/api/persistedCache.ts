import type { QueryClient } from "@tanstack/react-query";
import { del, get, set } from "idb-keyval";
import { z } from "zod";
import { persistedQueryRoots } from "./keys";
import { useAuthStore } from "../auth/store";

export const PERSISTED_CACHE_KEY = "fleet.query-cache";
export const PERSISTED_CACHE_SCHEMA_VERSION = 1;
export const PERSISTED_CACHE_MAX_AGE_MS = 24 * 60 * 60_000;
export const PERSISTED_CACHE_DEBOUNCE_MS = 750;

const persistedRoots = new Set<string>(persistedQueryRoots);

const persistedEntrySchema = z.object({
  queryKey: z.array(z.unknown()),
  data: z.unknown(),
  updatedAt: z.number(),
});

const persistedCacheSchema = z.object({
  buster: z.string(),
  savedAt: z.number(),
  entries: z.array(persistedEntrySchema),
});

type PersistedCachePayload = z.infer<typeof persistedCacheSchema>;

export interface PersistedCacheOptions {
  now?: () => number;
  buster?: () => string;
  debounceMs?: number;
  isEnabled?: () => boolean;
}

export function cacheBuster(): string {
  const version = import.meta.env.VITE_APP_VERSION ?? "dev";
  return `${version}:${PERSISTED_CACHE_SCHEMA_VERSION}`;
}

export function isPersistedQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return typeof root === "string" && persistedRoots.has(root);
}

let storageNoticeSent = false;

function dispatchStorageUnavailable(): void {
  if (storageNoticeSent || typeof window === "undefined") return;
  storageNoticeSent = true;
  window.dispatchEvent(new CustomEvent("fleet:storage-unavailable"));
}

/** Called when a bounded startup read times out, so the shell explains itself. */
export function reportStorageUnavailable(): void {
  dispatchStorageUnavailable();
}

/** Test seam: the once-per-session notice is module state. */
export function resetStorageNoticeForTests(): void {
  storageNoticeSent = false;
}

function collectEntries(client: QueryClient): PersistedCachePayload["entries"] {
  const entries: PersistedCachePayload["entries"] = [];
  for (const query of client.getQueryCache().getAll()) {
    if (query.state.status !== "success") continue;
    if (query.state.data === undefined) continue;
    if (!isPersistedQueryKey(query.queryKey)) continue;
    entries.push({
      queryKey: [...query.queryKey],
      data: query.state.data,
      updatedAt: query.state.dataUpdatedAt,
    });
  }
  return entries;
}

export async function savePersistedCache(
  client: QueryClient,
  options: PersistedCacheOptions = {},
): Promise<void> {
  const now = options.now ?? Date.now;
  const payload: PersistedCachePayload = {
    buster: (options.buster ?? cacheBuster)(),
    savedAt: now(),
    entries: collectEntries(client),
  };
  try {
    await set(PERSISTED_CACHE_KEY, payload);
  } catch {
    dispatchStorageUnavailable();
  }
}

async function discard(): Promise<void> {
  try {
    await del(PERSISTED_CACHE_KEY);
  } catch {
    dispatchStorageUnavailable();
  }
}

export async function restorePersistedCache(
  client: QueryClient,
  options: PersistedCacheOptions = {},
): Promise<number> {
  const now = options.now ?? Date.now;
  let raw: unknown;
  try {
    raw = await get<unknown>(PERSISTED_CACHE_KEY);
  } catch {
    dispatchStorageUnavailable();
    return 0;
  }
  if (raw === undefined) return 0;

  const parsed = persistedCacheSchema.safeParse(raw);
  if (!parsed.success) {
    await discard();
    return 0;
  }

  const payload = parsed.data;
  if (
    payload.buster !== (options.buster ?? cacheBuster)() ||
    now() - payload.savedAt > PERSISTED_CACHE_MAX_AGE_MS
  ) {
    await discard();
    return 0;
  }

  let restored = 0;
  for (const entry of payload.entries) {
    if (!isPersistedQueryKey(entry.queryKey)) continue;
    client.setQueryData(entry.queryKey, entry.data, { updatedAt: entry.updatedAt });
    restored += 1;
  }
  return restored;
}

export async function clearPersistedCache(): Promise<void> {
  await discard();
}

let activeStop: (() => void) | null = null;

/**
 * Subscribes to query cache changes and writes the allowlisted success data
 * after a quiet period. Returns a stop function; callers must stop before
 * clearing the cache on sign-out so a late debounce cannot repopulate it.
 */
export function startPersistedCache(
  client: QueryClient,
  options: PersistedCacheOptions = {},
): () => void {
  const debounceMs = options.debounceMs ?? PERSISTED_CACHE_DEBOUNCE_MS;
  const isEnabled =
    options.isEnabled ??
    (() => useAuthStore.getState().status === "authenticated");
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!isEnabled()) return;
    void savePersistedCache(client, options);
  };

  const schedule = () => {
    if (!isEnabled()) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  const unsubscribe = client.getQueryCache().subscribe(schedule);
  const onHide = () => {
    if (document.visibilityState === "hidden") flush();
  };
  const onPageHide = () => flush();

  if (typeof window !== "undefined") {
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
  }

  const stop = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    unsubscribe();
    if (typeof window !== "undefined") {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    }
    if (activeStop === stop) activeStop = null;
  };

  activeStop?.();
  activeStop = stop;
  return stop;
}

export function stopPersistedCache(): void {
  activeStop?.();
  activeStop = null;
}

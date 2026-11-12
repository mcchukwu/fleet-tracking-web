import { clear, del, get, set } from "idb-keyval";
import { z } from "zod";
import { StorageError } from "../errors/types";

export const RECENT_IMPORT_LIMIT = 5;
export const IMPORT_HISTORY_KEY = "fleet.import-history";
export const IMPORT_HISTORY_OWNER_KEY = "fleet.import-history-owner";

const importRowErrorSchema = z.object({
  row: z.number(),
  message: z.string(),
});

export const recentImportSchema = z.object({
  jobId: z.string(),
  fileName: z.string(),
  completedAt: z.string(),
  total: z.number(),
  imported: z.number(),
  failed: z.number(),
  errors: z.array(importRowErrorSchema).nullable(),
});

export type RecentImport = z.infer<typeof recentImportSchema>;

function storageFailure(): StorageError {
  return new StorageError("Import history is unavailable on this device");
}

export async function readImportHistory(): Promise<RecentImport[]> {
  let raw: unknown;
  try {
    raw = await get<unknown>(IMPORT_HISTORY_KEY);
  } catch {
    throw storageFailure();
  }
  if (!Array.isArray(raw)) return [];

  const entries: RecentImport[] = [];
  for (const candidate of raw) {
    const parsed = recentImportSchema.safeParse(candidate);
    if (parsed.success) entries.push(parsed.data);
  }
  return entries;
}

export async function addImportHistory(entry: RecentImport): Promise<RecentImport[]> {
  const current = await readImportHistory();
  const next = [
    entry,
    ...current.filter((item) => item.jobId !== entry.jobId),
  ].slice(0, RECENT_IMPORT_LIMIT);

  try {
    await set(IMPORT_HISTORY_KEY, next);
  } catch {
    throw storageFailure();
  }
  return next;
}

/**
 * Binds the device-local history to one user. Returns the previous owner when
 * the store had to be cleared, so the shell can also drop cached queries.
 */
export async function claimImportHistory(userId: string): Promise<string | null> {
  let owner: unknown;
  try {
    owner = await get<unknown>(IMPORT_HISTORY_OWNER_KEY);
  } catch {
    throw storageFailure();
  }
  if (owner === userId) return null;

  try {
    await del(IMPORT_HISTORY_KEY);
    await set(IMPORT_HISTORY_OWNER_KEY, userId);
  } catch {
    throw storageFailure();
  }
  return typeof owner === "string" ? owner : null;
}

export async function clearImportHistory(): Promise<void> {
  try {
    await del(IMPORT_HISTORY_KEY);
    await del(IMPORT_HISTORY_OWNER_KEY);
  } catch {
    throw storageFailure();
  }
}

/**
 * Sign-out and user change wipe every device-local record: the persisted query
 * cache, the offline profile and import history. Only this path may clear the
 * whole store.
 */
export async function wipeDeviceData(): Promise<void> {
  try {
    await clear();
  } catch {
    throw storageFailure();
  }
}

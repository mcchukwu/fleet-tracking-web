import { clear, get, set } from "idb-keyval";
import { z } from "zod";
import { StorageError } from "../errors/types";
import { RECENT_IMPORT_LIMIT } from "../features/import/lib/constants";

export const IMPORT_HISTORY_KEY = "fleet.import-history";

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

export async function clearImportHistory(): Promise<void> {
  try {
    await clear();
  } catch {
    throw storageFailure();
  }
}

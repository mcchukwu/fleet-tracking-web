import { del, get, set } from "idb-keyval";
import { z } from "zod";
import type { User } from "../api/types";
import { StorageError } from "../errors/types";

export const OFFLINE_PROFILE_KEY = "fleet.offline-profile";

const roleSchema = z.enum(["admin", "dispatcher", "security", "viewer"]);

const offlineProfileSchema = z.object({
  user: z.object({
    id: z.string(),
    tenant_id: z.string(),
    email: z.string(),
    name: z.string(),
    role: roleSchema,
  }),
  savedAt: z.number(),
});

type OfflineProfile = z.infer<typeof offlineProfileSchema>;

function storageFailure(): StorageError {
  return new StorageError("The offline profile is unavailable on this device");
}

export async function saveOfflineProfile(
  user: User,
  now: () => number = Date.now,
): Promise<void> {
  const profile: OfflineProfile = {
    user: {
      id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    savedAt: now(),
  };
  try {
    await set(OFFLINE_PROFILE_KEY, profile);
  } catch {
    throw storageFailure();
  }
}

export async function loadOfflineProfile(): Promise<User | null> {
  let raw: unknown;
  try {
    raw = await get<unknown>(OFFLINE_PROFILE_KEY);
  } catch {
    throw storageFailure();
  }
  const parsed = offlineProfileSchema.safeParse(raw);
  return parsed.success ? parsed.data.user : null;
}

export async function clearOfflineProfile(): Promise<void> {
  try {
    await del(OFFLINE_PROFILE_KEY);
  } catch {
    throw storageFailure();
  }
}

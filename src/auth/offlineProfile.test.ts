import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../api/types";
import { StorageError } from "../errors/types";
import {
  clearOfflineProfile,
  loadOfflineProfile,
  OFFLINE_PROFILE_KEY,
  saveOfflineProfile,
} from "./offlineProfile";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

vi.mock("idb-keyval", () => ({
  get: mocks.get,
  set: mocks.set,
  del: mocks.del,
}));

const user: User = {
  id: "user-1",
  tenant_id: "tenant-1",
  email: "dispatcher@example.test",
  name: "Demo Dispatcher",
  role: "dispatcher",
};

beforeEach(() => {
  mocks.get.mockReset();
  mocks.set.mockReset();
  mocks.del.mockReset();
  mocks.set.mockResolvedValue(undefined);
  mocks.del.mockResolvedValue(undefined);
});

describe("offline profile", () => {
  it("saves only the minimal user profile", async () => {
    await saveOfflineProfile(user, () => 42);

    const [key, value] = mocks.set.mock.calls[0] as [string, Record<string, unknown>];
    expect(key).toBe(OFFLINE_PROFILE_KEY);
    expect(value).toEqual({ user, savedAt: 42 });
    expect(JSON.stringify(value)).not.toContain("csrf");
  });

  it("loads a saved profile", async () => {
    mocks.get.mockResolvedValue({ user, savedAt: 1 });
    await expect(loadOfflineProfile()).resolves.toEqual(user);
  });

  it("rejects a corrupt profile", async () => {
    mocks.get.mockResolvedValue({ user: { id: "user-1" }, savedAt: 1 });
    await expect(loadOfflineProfile()).resolves.toBeNull();

    mocks.get.mockResolvedValue({ user: { ...user, role: "owner" }, savedAt: 1 });
    await expect(loadOfflineProfile()).resolves.toBeNull();

    mocks.get.mockResolvedValue("nope");
    await expect(loadOfflineProfile()).resolves.toBeNull();
  });

  it("has no profile when the store is empty", async () => {
    mocks.get.mockResolvedValue(undefined);
    await expect(loadOfflineProfile()).resolves.toBeNull();
  });

  it("clears the profile", async () => {
    await clearOfflineProfile();
    expect(mocks.del).toHaveBeenCalledWith(OFFLINE_PROFILE_KEY);
  });

  it("reports storage failure as a storage error", async () => {
    mocks.get.mockRejectedValue(new Error("blocked"));
    await expect(loadOfflineProfile()).rejects.toBeInstanceOf(StorageError);

    mocks.set.mockRejectedValue(new Error("quota"));
    await expect(saveOfflineProfile(user)).rejects.toBeInstanceOf(StorageError);

    mocks.del.mockRejectedValue(new Error("blocked"));
    await expect(clearOfflineProfile()).rejects.toBeInstanceOf(StorageError);
  });
});

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { persistedQueryRoots } from "./keys";
import {
  clearPersistedCache,
  isPersistedQueryKey,
  PERSISTED_CACHE_KEY,
  PERSISTED_CACHE_MAX_AGE_MS,
  resetStorageNoticeForTests,
  restorePersistedCache,
  savePersistedCache,
  startPersistedCache,
} from "./persistedCache";

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

const HOUR = 60 * 60_000;

function payload(entries: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    buster: "test:1",
    savedAt: 1_000,
    entries,
    ...overrides,
  };
}

function successClient(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(["live-snapshot"], [{ id: "v1" }]);
  client.setQueryData(["alerts", "feed", {}], [{ id: "a1" }]);
  client.setQueryData(["me"], { user: { id: "u1" }, csrf_token: "secret" });
  client.setQueryData(["audit", "feed"], [{ id: "entry" }]);
  client.setQueryData(["vehicle-history", "v1", {}], [{ lat: 1 }]);
  return client;
}

beforeEach(() => {
  mocks.get.mockReset();
  mocks.set.mockReset();
  mocks.del.mockReset();
  mocks.set.mockResolvedValue(undefined);
  mocks.del.mockResolvedValue(undefined);
  resetStorageNoticeForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("persisted query allowlist", () => {
  it("accepts every persisted root", () => {
    for (const root of persistedQueryRoots) {
      expect(isPersistedQueryKey([root])).toBe(true);
      expect(isPersistedQueryKey([root, "child"])).toBe(true);
    }
  });

  it("rejects the session, audit history and playback history", () => {
    expect(isPersistedQueryKey(["me"])).toBe(false);
    expect(isPersistedQueryKey(["audit", "feed"])).toBe(false);
    expect(isPersistedQueryKey(["audit", "lookup", "1"])).toBe(false);
    expect(isPersistedQueryKey(["vehicle-history", "v1"])).toBe(false);
    expect(isPersistedQueryKey([])).toBe(false);
    expect(isPersistedQueryKey([42])).toBe(false);
  });
});

describe("saving the query cache", () => {
  it("writes only allowed success data to one entry", async () => {
    const client = successClient();
    await savePersistedCache(client, { now: () => 5_000, buster: () => "test:1" });

    expect(mocks.set).toHaveBeenCalledTimes(1);
    const [key, value] = mocks.set.mock.calls[0] as [string, unknown];
    expect(key).toBe(PERSISTED_CACHE_KEY);
    expect(value).toMatchObject({ buster: "test:1", savedAt: 5_000 });
    const entries = (value as { entries: { queryKey: unknown[] }[] }).entries;
    expect(entries.map((entry) => entry.queryKey[0])).toEqual([
      "live-snapshot",
      "alerts",
    ]);
  });

  it("skips queries without data", async () => {
    const client = new QueryClient();
    client.setQueryData(["drivers"], undefined);
    await savePersistedCache(client, { now: () => 1, buster: () => "test:1" });

    const [, value] = mocks.set.mock.calls[0] as [string, { entries: unknown[] }];
    expect(value.entries).toEqual([]);
  });

  it("dispatches one storage notice per session when the write fails", async () => {
    const listener = vi.fn();
    window.addEventListener("fleet:storage-unavailable", listener);
    mocks.set.mockRejectedValue(new Error("quota"));

    const client = successClient();
    await savePersistedCache(client, { now: () => 1, buster: () => "test:1" });
    await savePersistedCache(client, { now: () => 2, buster: () => "test:1" });

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("fleet:storage-unavailable", listener);
  });

  it("deletes the stored cache", async () => {
    await clearPersistedCache();
    expect(mocks.del).toHaveBeenCalledWith(PERSISTED_CACHE_KEY);
  });
});

describe("restoring the query cache", () => {
  it("restores data with its original update time", async () => {
    const at = 10_000;
    mocks.get.mockResolvedValue(payload([{ queryKey: ["alerts", "feed", {}], data: [{ id: "a1" }], updatedAt: at }]));

    const client = new QueryClient();
    const restored = await restorePersistedCache(client, { now: () => at + HOUR, buster: () => "test:1" });

    expect(restored).toBe(1);
    expect(client.getQueryData(["alerts", "feed", {}])).toEqual([{ id: "a1" }]);
    expect(client.getQueryState(["alerts", "feed", {}])?.dataUpdatedAt).toBe(at);
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it("discards a payload written by another build", async () => {
    mocks.get.mockResolvedValue(payload([{ queryKey: ["drivers"], data: [], updatedAt: 1 }], { buster: "old:1" }));

    const client = new QueryClient();
    await expect(restorePersistedCache(client, { now: () => 2, buster: () => "test:1" })).resolves.toBe(0);

    expect(client.getQueryData(["drivers"])).toBeUndefined();
    expect(mocks.del).toHaveBeenCalledWith(PERSISTED_CACHE_KEY);
  });

  it("discards a payload older than a day", async () => {
    mocks.get.mockResolvedValue(payload([{ queryKey: ["drivers"], data: [], updatedAt: 1 }], { savedAt: 1 }));

    const client = new QueryClient();
    const restored = await restorePersistedCache(client, {
      now: () => 1 + PERSISTED_CACHE_MAX_AGE_MS + 1,
      buster: () => "test:1",
    });

    expect(restored).toBe(0);
    expect(client.getQueryData(["drivers"])).toBeUndefined();
    expect(mocks.del).toHaveBeenCalledWith(PERSISTED_CACHE_KEY);
  });

  it("discards a corrupt payload", async () => {
    mocks.get.mockResolvedValue({ buster: "test:1", savedAt: 1, entries: "nope" });

    const client = new QueryClient();
    await expect(restorePersistedCache(client, { now: () => 2, buster: () => "test:1" })).resolves.toBe(0);
    expect(mocks.del).toHaveBeenCalledWith(PERSISTED_CACHE_KEY);
  });

  it("ignores entries outside the allowlist without deleting the payload", async () => {
    mocks.get.mockResolvedValue(payload([
      { queryKey: ["audit", "feed"], data: [{ id: "1" }], updatedAt: 1 },
      { queryKey: ["drivers"], data: [], updatedAt: 1 },
    ]));

    const client = new QueryClient();
    const restored = await restorePersistedCache(client, { now: () => 2, buster: () => "test:1" });

    expect(restored).toBe(1);
    expect(client.getQueryData(["audit", "feed"])).toBeUndefined();
    expect(client.getQueryData(["drivers"])).toEqual([]);
  });

  it("treats a missing payload as an empty cache", async () => {
    mocks.get.mockResolvedValue(undefined);
    const client = new QueryClient();
    await expect(restorePersistedCache(client, { now: () => 2, buster: () => "test:1" })).resolves.toBe(0);
    expect(mocks.del).not.toHaveBeenCalled();
  });
});

describe("persistence subscription", () => {
  it("debounces writes and flushes them", async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const stop = startPersistedCache(client, {
      now: () => 1,
      buster: () => "test:1",
      debounceMs: 750,
      isEnabled: () => true,
    });

    client.setQueryData(["drivers"], [{ id: "d1" }]);
    await vi.advanceTimersByTimeAsync(700);
    expect(mocks.set).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60);
    expect(mocks.set).toHaveBeenCalledTimes(1);

    stop();
  });

  it("flushes when the page is hidden", async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const stop = startPersistedCache(client, {
      now: () => 1,
      buster: () => "test:1",
      debounceMs: 750,
      isEnabled: () => true,
    });

    client.setQueryData(["drivers"], []);
    window.dispatchEvent(new Event("pagehide"));

    expect(mocks.set).toHaveBeenCalledTimes(1);
    stop();
  });

  it("does not write while disabled or after it stops", async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const disabled = startPersistedCache(client, {
      now: () => 1,
      buster: () => "test:1",
      debounceMs: 10,
      isEnabled: () => false,
    });
    client.setQueryData(["drivers"], []);
    await vi.advanceTimersByTimeAsync(20);
    expect(mocks.set).not.toHaveBeenCalled();
    disabled();

    const stop = startPersistedCache(client, {
      now: () => 1,
      buster: () => "test:1",
      debounceMs: 10,
      isEnabled: () => true,
    });
    stop();
    client.setQueryData(["drivers"], [{ id: "d1" }]);
    await vi.advanceTimersByTimeAsync(20);
    expect(mocks.set).not.toHaveBeenCalled();
  });
});

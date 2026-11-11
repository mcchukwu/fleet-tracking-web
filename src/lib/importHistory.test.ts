import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorageError } from "../errors/types";
import {
  addImportHistory,
  claimImportHistory,
  clearImportHistory,
  readImportHistory,
  type RecentImport,
} from "./importHistory";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn(),
}));

vi.mock("idb-keyval", () => ({
  get: mocks.get,
  set: mocks.set,
  clear: mocks.clear,
}));

function entry(jobId: string, completedAt = "2026-11-11T12:00:00Z"): RecentImport {
  return {
    jobId,
    fileName: `${jobId}.csv`,
    completedAt,
    total: 2,
    imported: 2,
    failed: 0,
    errors: null,
  };
}

beforeEach(() => {
  mocks.get.mockReset();
  mocks.set.mockReset();
  mocks.clear.mockReset();
  mocks.set.mockResolvedValue(undefined);
  mocks.clear.mockResolvedValue(undefined);
});

describe("import history", () => {
  it("reads an empty store", async () => {
    mocks.get.mockResolvedValue(undefined);
    await expect(readImportHistory()).resolves.toEqual([]);
  });

  it("drops corrupt entries and non-array values", async () => {
    mocks.get.mockResolvedValue([entry("job-1"), { jobId: 4 }, null]);
    await expect(readImportHistory()).resolves.toEqual([entry("job-1")]);

    mocks.get.mockResolvedValue({ jobId: "job-1" });
    await expect(readImportHistory()).resolves.toEqual([]);
  });

  it("adds newest first and caps at five", async () => {
    mocks.get.mockResolvedValue([
      entry("job-5"),
      entry("job-4"),
      entry("job-3"),
      entry("job-2"),
      entry("job-1"),
    ]);

    const next = await addImportHistory(entry("job-6"));

    expect(next.map((row) => row.jobId)).toEqual([
      "job-6",
      "job-5",
      "job-4",
      "job-3",
      "job-2",
    ]);
    expect(mocks.set).toHaveBeenCalledWith("fleet.import-history", next);
  });

  it("replaces the same job id instead of duplicating it", async () => {
    mocks.get.mockResolvedValue([entry("job-1"), entry("job-2")]);
    const next = await addImportHistory(entry("job-2", "2026-11-11T13:00:00Z"));

    expect(next.map((row) => row.jobId)).toEqual(["job-2", "job-1"]);
    expect(next[0]?.completedAt).toBe("2026-11-11T13:00:00Z");
  });

  it("keeps the history of the same owner", async () => {
    mocks.get.mockResolvedValue("user-1");

    await expect(claimImportHistory("user-1")).resolves.toBeNull();
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("drops another user's history and records the new owner", async () => {
    mocks.get.mockResolvedValue("user-1");

    await expect(claimImportHistory("user-2")).resolves.toBe("user-1");
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith(
      "fleet.import-history-owner",
      "user-2",
    );
  });

  it("clears unattributed history from devices without an owner", async () => {
    mocks.get.mockResolvedValue(undefined);

    await expect(claimImportHistory("user-1")).resolves.toBeNull();
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith(
      "fleet.import-history-owner",
      "user-1",
    );
  });

  it("surfaces a storage failure on read, write and clear", async () => {
    mocks.get.mockRejectedValue(new Error("idb unavailable"));
    await expect(readImportHistory()).rejects.toBeInstanceOf(StorageError);

    mocks.get.mockResolvedValue([]);
    mocks.set.mockRejectedValue(new Error("quota"));
    await expect(addImportHistory(entry("job-1"))).rejects.toBeInstanceOf(
      StorageError,
    );

    mocks.clear.mockRejectedValue(new Error("blocked"));
    await expect(clearImportHistory()).rejects.toBeInstanceOf(StorageError);

    mocks.get.mockRejectedValue(new Error("idb unavailable"));
    await expect(claimImportHistory("user-1")).rejects.toBeInstanceOf(
      StorageError,
    );
  });

  it("clears the store", async () => {
    await clearImportHistory();
    expect(mocks.clear).toHaveBeenCalledTimes(1);
  });
});

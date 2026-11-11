import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorageError } from "../../../errors/types";
import type { RecentImport } from "../../../lib/importHistory";
import { useRecentImports } from "./useRecentImports";

const mocks = vi.hoisted(() => ({
  readImportHistory: vi.fn(),
  addImportHistory: vi.fn(),
}));

vi.mock("../../../lib/importHistory", () => ({
  readImportHistory: mocks.readImportHistory,
  addImportHistory: mocks.addImportHistory,
}));

function entry(jobId: string): RecentImport {
  return {
    jobId,
    fileName: `${jobId}.csv`,
    completedAt: "2026-11-11T12:00:00Z",
    total: 2,
    imported: 2,
    failed: 0,
    errors: null,
  };
}

beforeEach(() => {
  mocks.readImportHistory.mockReset();
  mocks.addImportHistory.mockReset();
});

describe("useRecentImports", () => {
  it("loads this device's history", async () => {
    mocks.readImportHistory.mockResolvedValue([entry("job-1")]);
    const { result } = renderHook(() => useRecentImports());

    expect(result.current.state).toBe("loading");
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.entries).toEqual([entry("job-1")]);
  });

  it("adds a result at the top and clears a storage error", async () => {
    mocks.readImportHistory.mockResolvedValue([entry("job-1")]);
    mocks.addImportHistory.mockResolvedValue([entry("job-2"), entry("job-1")]);
    const { result } = renderHook(() => useRecentImports());
    await waitFor(() => expect(result.current.state).toBe("ready"));

    let saved = false;
    await act(async () => {
      saved = await result.current.add(entry("job-2"));
    });

    expect(saved).toBe(true);
    expect(result.current.entries.map((row) => row.jobId)).toEqual([
      "job-2",
      "job-1",
    ]);
    expect(result.current.error).toBeNull();
  });

  it("keeps the result on screen and offers a retry when the write fails", async () => {
    mocks.readImportHistory.mockResolvedValue([]);
    mocks.addImportHistory
      .mockRejectedValueOnce(new StorageError("quota"))
      .mockResolvedValueOnce([entry("job-2")]);
    const { result } = renderHook(() => useRecentImports());
    await waitFor(() => expect(result.current.state).toBe("ready"));

    let saved = true;
    await act(async () => {
      saved = await result.current.add(entry("job-2"));
    });
    expect(saved).toBe(false);
    expect(result.current.error?.kind).toBe("storage");

    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.entries).toEqual([entry("job-2")]);
  });

  it("shows a storage error when the initial read fails", async () => {
    mocks.readImportHistory.mockRejectedValue(new StorageError("blocked"));
    const { result } = renderHook(() => useRecentImports());
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.error?.kind).toBe("storage");
  });
});

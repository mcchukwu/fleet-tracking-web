import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useImportPreview } from "./useImportPreview";

const mocks = vi.hoisted(() => ({
  readImportFile: vi.fn(),
}));

vi.mock("../lib/preview", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/preview")>();
  return { ...actual, readImportFile: mocks.readImportFile };
});

function csvFile(name = "vehicles.csv"): File {
  return new File(["imei,plate\nimei-1,LSD-100-AA"], name, {
    type: "text/csv",
  });
}

beforeEach(() => {
  mocks.readImportFile.mockReset();
});

describe("useImportPreview", () => {
  it("is idle with no file", () => {
    const { result } = renderHook(() => useImportPreview(null));
    expect(result.current.state).toBe("idle");
    expect(mocks.readImportFile).not.toHaveBeenCalled();
  });

  it("rejects a file that is not .csv before reading it", async () => {
    const { result } = renderHook(() =>
      useImportPreview(csvFile("vehicles.txt")),
    );
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.issue).toBe("wrong-type");
    expect(mocks.readImportFile).not.toHaveBeenCalled();
  });

  it("rejects an empty file before reading it", async () => {
    const file = new File([], "vehicles.csv", { type: "text/csv" });
    const { result } = renderHook(() => useImportPreview(file));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.issue).toBe("empty-file");
  });

  it("parses a valid file into a ready preview", async () => {
    mocks.readImportFile.mockResolvedValue({
      rows: [
        ["imei", "plate"],
        ["imei-1", "LSD-100-AA"],
      ],
      bom: false,
      errorCount: 0,
    });
    const { result } = renderHook(() => useImportPreview(csvFile()));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.issue).toBeNull();
    expect(result.current.preview?.rows).toHaveLength(1);
  });

  it("reports a missing imei header", async () => {
    mocks.readImportFile.mockResolvedValue({
      rows: [["plate"], ["LSD-100-AA"]],
      bom: false,
      errorCount: 0,
    });
    const { result } = renderHook(() => useImportPreview(csvFile()));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.issue).toBe("missing-imei");
  });

  it("reports unreadable quoting as a parse failure", async () => {
    mocks.readImportFile.mockResolvedValue({
      rows: [["imei", "plate"]],
      bom: false,
      errorCount: 2,
    });
    const { result } = renderHook(() => useImportPreview(csvFile()));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.issue).toBe("unreadable");
  });

  it("keeps the BOM fact without a warning", async () => {
    mocks.readImportFile.mockResolvedValue({
      rows: [
        ["imei", "plate"],
        ["imei-1", "LSD-100-AA"],
      ],
      bom: true,
      errorCount: 0,
    });
    const { result } = renderHook(() => useImportPreview(csvFile()));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.preview?.bom).toBe(true);
  });

  it("ignores a stale parse when the file changes quickly", async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    let resolveSecond: ((value: unknown) => void) | undefined;
    mocks.readImportFile
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const first = csvFile("first.csv");
    const second = csvFile("second.csv");
    const { result, rerender } = renderHook(
      ({ file }) => useImportPreview(file),
      { initialProps: { file: first } },
    );

    rerender({ file: second });
    resolveSecond?.({
      rows: [
        ["imei", "plate"],
        ["imei-2", "LSD-200-AA"],
      ],
      bom: false,
      errorCount: 0,
    });
    await waitFor(() => expect(result.current.preview?.rows[0]?.[0]).toBe("imei-2"));

    resolveFirst?.({
      rows: [
        ["imei", "plate"],
        ["imei-1", "LSD-100-AA"],
      ],
      bom: false,
      errorCount: 0,
    });
    await waitFor(() =>
      expect(result.current.preview?.rows[0]?.[0]).toBe("imei-2"),
    );
  });
});

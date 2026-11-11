import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../errors/types";
import type { ImportResult } from "../../../api/types";
import { importFailureCopy } from "../lib/copy";
import { useImportUpload } from "./useImportUpload";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

vi.mock("../../../api/hooks/import", () => ({
  useImportVehicles: () => ({ mutateAsync: mocks.mutateAsync }),
}));

const result: ImportResult = {
  job_id: "job-1",
  total: 2,
  imported: 2,
  failed: 0,
  errors: null,
};

const file = new File(["imei\n1"], "vehicles.csv", { type: "text/csv" });

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (cause: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function abortable(): Deferred<ImportResult> {
  const pending = deferred<ImportResult>();
  return pending;
}

beforeEach(() => {
  mocks.mutateAsync.mockReset();
});

describe("useImportUpload", () => {
  it("uploads pessimistically and exposes the result", async () => {
    mocks.mutateAsync.mockResolvedValue(result);
    const { result: hook } = renderHook(() => useImportUpload());

    let outcome: Awaited<ReturnType<typeof hook.current.upload>> | undefined;
    await act(async () => {
      outcome = await hook.current.upload(file);
    });

    expect(outcome?.status).toBe("success");
    expect(hook.current.result).toEqual(result);
    expect(hook.current.pending).toBe(false);
    expect(hook.current.error).toBeNull();
  });

  it("blocks a double submit while the first upload is in flight", async () => {
    const pending = deferred<ImportResult>();
    mocks.mutateAsync.mockReturnValue(pending.promise);
    const { result: hook } = renderHook(() => useImportUpload());

    let first: Promise<unknown> | undefined;
    act(() => {
      first = hook.current.upload(file);
    });
    await act(async () => {
      const second = await hook.current.upload(file);
      expect(second.status).toBe("ignored");
    });
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(result);
      await first;
    });
    expect(hook.current.result).toEqual(result);
  });

  it("cancels without reporting an error or a result", async () => {
    mocks.mutateAsync.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const { result: hook } = renderHook(() => useImportUpload());

    let outcome: Awaited<ReturnType<typeof hook.current.upload>> | undefined;
    await act(async () => {
      const pending = hook.current.upload(file);
      hook.current.cancel();
      outcome = await pending;
    });

    expect(outcome?.status).toBe("cancelled");
    expect(hook.current.status).toBe("cancelled");
    expect(hook.current.error).toBeNull();
    expect(hook.current.result).toBeNull();
  });

  it("retries once after the first attempt settles", async () => {
    const first = abortable();
    mocks.mutateAsync
      .mockImplementationOnce(
        ({ signal }: { signal: AbortSignal }) => {
          signal.addEventListener("abort", () =>
            first.reject(new DOMException("aborted", "AbortError")),
          );
          return first.promise;
        },
      )
      .mockResolvedValueOnce(result);
    const { result: hook } = renderHook(() => useImportUpload());

    let attempt: Promise<Awaited<ReturnType<typeof hook.current.upload>>> =
      Promise.resolve({ status: "ignored" });
    act(() => {
      attempt = hook.current.upload(file);
    });
    act(() => {
      hook.current.retry();
    });

    let outcome: Awaited<typeof attempt> | undefined;
    await act(async () => {
      outcome = await attempt;
    });

    expect(outcome?.status).toBe("success");
    expect(hook.current.result).toEqual(result);
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(2);
    expect(hook.current.error).toBeNull();
  });

  it("keeps a network failure as an unknown outcome with safe copy", async () => {
    mocks.mutateAsync.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result: hook } = renderHook(() => useImportUpload());

    let outcome: Awaited<ReturnType<typeof hook.current.upload>> | undefined;
    await act(async () => {
      outcome = await hook.current.upload(file);
    });

    expect(outcome?.status).toBe("error");
    expect(hook.current.error?.kind).toBe("network");
    expect(hook.current.error?.outcome).toBe("unknown");
    expect(importFailureCopy(hook.current.error!).detail).toBe(
      "It's safe to upload again.",
    );
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("does not call a server rejection an unknown outcome", async () => {
    mocks.mutateAsync.mockRejectedValue(
      new ApiError(500, "internal", "panic: nil pointer"),
    );
    const { result: hook } = renderHook(() => useImportUpload());

    await act(async () => {
      await hook.current.upload(file);
    });

    expect(hook.current.error?.kind).toBe("server");
    expect(hook.current.error?.outcome).toBe("failed");
  });

  it("clears the previous result and error on reset", async () => {
    mocks.mutateAsync.mockResolvedValue(result);
    const { result: hook } = renderHook(() => useImportUpload());
    await act(async () => {
      await hook.current.upload(file);
    });

    act(() => hook.current.reset());

    expect(hook.current.status).toBe("idle");
    expect(hook.current.result).toBeNull();
    expect(hook.current.error).toBeNull();
  });
});

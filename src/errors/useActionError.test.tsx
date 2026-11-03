import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useActionError } from "./useActionError";
import { normalize } from "./normalize";

function unknownOutcome() {
  return normalize(new TypeError("Failed to fetch"), { route: "/trips" }, { outcome: "unknown" });
}

describe("useActionError", () => {
  it("returns the action value on success", async () => {
    const { result } = renderHook(() => useActionError());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      outcome = await result.current.run(() => Promise.resolve(42));
    });
    expect(outcome).toEqual({ status: "success", value: 42 });
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("records an unknown write outcome without claiming failure", async () => {
    const { result } = renderHook(() => useActionError());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      outcome = await result.current.run(() => Promise.reject(unknownOutcome()));
    });
    expect(outcome?.status).toBe("error");
    if (outcome?.status === "error") {
      expect(outcome.error.outcome).toBe("unknown");
    }
  });

  it("reports success when reconciliation finds the write", async () => {
    const { result } = renderHook(() => useActionError());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      outcome = await result.current.run(() => Promise.reject(unknownOutcome()), {
        reconcile: () => Promise.resolve("saved"),
      });
    });
    expect(outcome).toEqual({ status: "reconciled" });
    expect(result.current.error).toBeNull();
  });

  it("reports failure when reconciliation proves the write did not land", async () => {
    const { result } = renderHook(() => useActionError());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      outcome = await result.current.run(() => Promise.reject(unknownOutcome()), {
        reconcile: () => Promise.resolve("not_saved"),
      });
    });
    expect(outcome?.status).toBe("error");
    if (outcome?.status === "error") {
      expect(outcome.error.outcome).toBe("failed");
    }
  });

  it("keeps the unknown outcome when reconciliation cannot reach the server", async () => {
    const { result } = renderHook(() => useActionError());
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      outcome = await result.current.run(() => Promise.reject(unknownOutcome()), {
        reconcile: () => Promise.reject(new TypeError("offline")),
      });
    });
    expect(outcome?.status).toBe("error");
    if (outcome?.status === "error") {
      expect(outcome.error.outcome).toBe("unknown");
    }
  });
});

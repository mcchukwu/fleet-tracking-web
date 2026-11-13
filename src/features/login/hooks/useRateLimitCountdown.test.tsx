import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRateLimitCountdown } from "./useRateLimitCountdown";
import type { AppError } from "../../../errors/types";

function rateLimited(retryAfterSec?: number, at = Date.now()): AppError {
  return {
    kind: "rate_limited",
    retryable: true,
    outcome: "failed",
    retryAfterSec,
    context: { route: "/login" },
    at,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useRateLimitCountdown", () => {
  it("counts down from Retry-After and stops at zero", async () => {
    const error = rateLimited(3);
    const { result } = renderHook(() => useRateLimitCountdown(error));

    expect(result.current).toBe(3);
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(2);
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current).toBe(0);
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toBe(0);
  });

  it("returns null and starts no timer without Retry-After", () => {
    const error = rateLimited();
    const { result } = renderHook(() => useRateLimitCountdown(error));

    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("catches up after the tab was hidden", async () => {
    const error = rateLimited(30);
    const { result } = renderHook(() => useRateLimitCountdown(error));

    await act(async () => {
      vi.advanceTimersByTime(45_000);
    });
    expect(result.current).toBe(0);
  });

  it("clears its timer on unmount", () => {
    const error = rateLimited(30);
    const { unmount } = renderHook(() => useRateLimitCountdown(error));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

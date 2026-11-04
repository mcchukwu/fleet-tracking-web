import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedCallback } from "./useDebouncedCallback";

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedCallback", () => {
  it("calls once with the latest arguments after the delay", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 150));

    act(() => {
      result.current("a");
      result.current("ab");
      result.current("abc");
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith("abc");
  });

  it("drops a pending call when unmounted", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 150));

    act(() => {
      result.current("a");
    });
    unmount();

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(callback).not.toHaveBeenCalled();
  });
});

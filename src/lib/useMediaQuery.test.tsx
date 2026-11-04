import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

describe("useMediaQuery", () => {
  it("reads the initial match and follows changes", () => {
    let matches = false;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches,
          media: query,
          addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
            listeners.add(listener),
          removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
            listeners.delete(listener),
        }) as unknown as MediaQueryList,
    );

    const { result, unmount } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
    expect(result.current).toBe(false);

    act(() => {
      matches = true;
      for (const listener of listeners) listener({ matches: true } as MediaQueryListEvent);
    });
    expect(result.current).toBe(true);

    unmount();
    expect(listeners.size).toBe(0);
  });
});

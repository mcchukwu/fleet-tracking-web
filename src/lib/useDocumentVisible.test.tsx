import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDocumentVisible } from "./useDocumentVisible";

function setVisibility(value: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => value,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  setVisibility("visible");
});

describe("useDocumentVisible", () => {
  it("starts visible", () => {
    const { result } = renderHook(() => useDocumentVisible());
    expect(result.current).toBe(true);
  });

  it("follows visibility changes", () => {
    const { result } = renderHook(() => useDocumentVisible());

    act(() => setVisibility("hidden"));
    expect(result.current).toBe(false);

    act(() => setVisibility("visible"));
    expect(result.current).toBe(true);
  });

  it("removes its listener on unmount", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useDocumentVisible());

    const listener = add.mock.calls.find(
      ([type]) => type === "visibilitychange",
    )?.[1];
    expect(listener).toBeDefined();

    unmount();
    expect(remove).toHaveBeenCalledWith("visibilitychange", listener);
  });
});

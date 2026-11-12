import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  PICKER_MEDIA_QUERY,
  pickerPresentation,
  usePickerPresentation,
} from "./usePickerPresentation";

const originalMatchMedia = window.matchMedia;

type Listener = (event: MediaQueryListEvent) => void;

function mockMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: Listener) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) =>
      listeners.delete(listener),
    addListener: (listener: Listener) => listeners.add(listener),
    removeListener: (listener: Listener) => listeners.delete(listener),
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia;

  return {
    set(next: boolean) {
      matches = next;
      for (const listener of listeners) {
        listener({ matches: next } as MediaQueryListEvent);
      }
    },
  };
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("pickerPresentation", () => {
  it("maps a matching fine-pointer desktop viewport to the popover", () => {
    expect(pickerPresentation(true)).toBe("popover");
    expect(pickerPresentation(false)).toBe("sheet");
  });
});

describe("usePickerPresentation", () => {
  it("uses the popover at a wide fine-pointer viewport", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => usePickerPresentation());
    expect(result.current).toBe("popover");
  });

  it("uses the sheet on a narrow viewport or a coarse pointer", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => usePickerPresentation());
    expect(result.current).toBe("sheet");
  });

  it("falls back to the popover when matchMedia is unavailable", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: undefined,
    });
    const { result } = renderHook(() => usePickerPresentation());
    expect(result.current).toBe("popover");
  });

  it("follows the media query when the viewport changes", () => {
    const media = mockMatchMedia(true);
    const { result } = renderHook(() => usePickerPresentation());
    expect(result.current).toBe("popover");

    act(() => media.set(false));
    expect(result.current).toBe("sheet");

    act(() => media.set(true));
    expect(result.current).toBe("popover");
  });

  it("queries the documented breakpoint and pointer combination", () => {
    mockMatchMedia(true);
    renderHook(() => usePickerPresentation());
    expect(PICKER_MEDIA_QUERY).toBe("(min-width: 768px) and (pointer: fine)");
  });
});

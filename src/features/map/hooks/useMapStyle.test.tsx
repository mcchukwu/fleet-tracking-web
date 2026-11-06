import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { guardedStorage } from "../../../lib/storage";
import { useConnectionStore } from "../../../stores/connection";
import { useMapStyle } from "./useMapStyle";

const STYLE_KEY = "fleet.map.style";
const both = ["standard", "satellite"] as const;

beforeEach(() => {
  localStorage.clear();
  guardedStorage.remove(STYLE_KEY);
  useConnectionStore.setState({ network: "online" });
});

describe("useMapStyle", () => {
  it("defaults to the standard map and only offers what the build supports", () => {
    const { result } = renderHook(() => useMapStyle({ styles: ["standard"] }));
    expect(result.current.chosenStyle).toBe("standard");
    expect(result.current.effectiveStyle).toBe("standard");
    expect(result.current.styles).toEqual(["standard"]);
  });

  it("restores a persisted choice", () => {
    guardedStorage.set(STYLE_KEY, "satellite");
    const { result } = renderHook(() => useMapStyle({ styles: both }));
    expect(result.current.chosenStyle).toBe("satellite");
    expect(result.current.effectiveStyle).toBe("satellite");
  });

  it("persists a valid choice and ignores an unavailable one", () => {
    const { result } = renderHook(() => useMapStyle({ styles: both }));
    act(() => result.current.chooseStyle("satellite"));
    expect(result.current.chosenStyle).toBe("satellite");
    expect(guardedStorage.get(STYLE_KEY)).toBe("satellite");

    const limited = renderHook(() => useMapStyle({ styles: ["standard"] }));
    act(() => limited.result.current.chooseStyle("satellite"));
    expect(limited.result.current.chosenStyle).toBe("standard");
  });

  it("falls back to standard offline, restores the choice online and notices once", () => {
    guardedStorage.set(STYLE_KEY, "satellite");
    useConnectionStore.setState({ network: "offline" });
    const { result } = renderHook(() => useMapStyle({ styles: both }));

    expect(result.current.chosenStyle).toBe("satellite");
    expect(result.current.effectiveStyle).toBe("standard");
    expect(result.current.fallbackNotice).toBe(true);

    act(() => result.current.dismissFallbackNotice());
    expect(result.current.fallbackNotice).toBe(false);

    act(() => useConnectionStore.setState({ network: "online" }));
    expect(result.current.effectiveStyle).toBe("satellite");

    act(() => useConnectionStore.setState({ network: "offline" }));
    expect(result.current.fallbackNotice).toBe(true);
  });

  it("does not notice when the chosen style already works offline", () => {
    useConnectionStore.setState({ network: "offline" });
    const { result } = renderHook(() => useMapStyle({ styles: both }));
    expect(result.current.effectiveStyle).toBe("standard");
    expect(result.current.fallbackNotice).toBe(false);
  });
});

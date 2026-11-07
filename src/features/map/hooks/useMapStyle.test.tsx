import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { guardedStorage } from "../../../lib/storage";
import { useConnectionStore } from "../../../stores/connection";
import { useMapStyle } from "./useMapStyle";

const STYLE_KEY = "fleet.map.style";
const all = ["standard", "streets", "satellite"] as const;

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
    const { result } = renderHook(() => useMapStyle({ styles: all }));
    expect(result.current.chosenStyle).toBe("satellite");
    expect(result.current.effectiveStyle).toBe("satellite");
  });

  it("persists a valid choice and ignores an unavailable one", () => {
    const { result } = renderHook(() => useMapStyle({ styles: all }));
    act(() => result.current.chooseStyle("streets"));
    expect(result.current.chosenStyle).toBe("streets");
    expect(guardedStorage.get(STYLE_KEY)).toBe("streets");

    const limited = renderHook(() => useMapStyle({ styles: ["standard"] }));
    act(() => limited.result.current.chooseStyle("satellite"));
    expect(limited.result.current.chosenStyle).toBe("standard");
  });

  it("falls back to standard offline, restores the choice online and notices once", () => {
    guardedStorage.set(STYLE_KEY, "satellite");
    useConnectionStore.setState({ network: "offline" });
    const { result } = renderHook(() => useMapStyle({ styles: all }));

    expect(result.current.chosenStyle).toBe("satellite");
    expect(result.current.effectiveStyle).toBe("standard");
    expect(result.current.fallback).toEqual({ style: "satellite", reason: "offline" });

    act(() => result.current.dismissFallback());
    expect(result.current.fallback).toBeNull();

    act(() => useConnectionStore.setState({ network: "online" }));
    expect(result.current.effectiveStyle).toBe("satellite");

    act(() => useConnectionStore.setState({ network: "offline" }));
    expect(result.current.fallback).toEqual({ style: "satellite", reason: "offline" });
  });

  it("does not notice when the chosen style already works offline", () => {
    useConnectionStore.setState({ network: "offline" });
    const { result } = renderHook(() => useMapStyle({ styles: all }));
    expect(result.current.effectiveStyle).toBe("standard");
    expect(result.current.fallback).toBeNull();
  });

  it("does not switch to a hosted style while offline", () => {
    useConnectionStore.setState({ network: "offline" });
    const { result } = renderHook(() => useMapStyle({ styles: all }));
    act(() => result.current.chooseStyle("streets"));
    expect(result.current.chosenStyle).toBe("standard");
    expect(guardedStorage.get(STYLE_KEY)).toBeNull();
  });

  it("reverts a failed hosted style to Map and raises one notice", () => {
    guardedStorage.set(STYLE_KEY, "satellite");
    const { result } = renderHook(() => useMapStyle({ styles: all }));

    act(() => result.current.failStyle("satellite", "quota"));
    expect(result.current.chosenStyle).toBe("standard");
    expect(result.current.effectiveStyle).toBe("standard");
    expect(result.current.fallback).toEqual({ style: "satellite", reason: "quota" });
    expect(guardedStorage.get(STYLE_KEY)).toBe("standard");
  });

  it("ignores a repeated failure notice for the same style", () => {
    guardedStorage.set(STYLE_KEY, "streets");
    const { result } = renderHook(() => useMapStyle({ styles: all }));

    act(() => result.current.failStyle("streets", "failed"));
    const first = result.current.fallback;
    act(() => result.current.failStyle("streets", "failed"));
    expect(result.current.fallback).toBe(first);
  });
});

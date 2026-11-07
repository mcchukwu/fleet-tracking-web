import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFlashOnChange } from "./useFlashOnChange";

describe("useFlashOnChange", () => {
  it("does not flash on the first render", () => {
    const { result } = renderHook(({ value }) => useFlashOnChange(value), {
      initialProps: { value: 1 },
    });
    expect(result.current).toBe(0);
  });

  it("advances the key once per real change", () => {
    const { result, rerender } = renderHook(({ value }) => useFlashOnChange(value), {
      initialProps: { value: 1 },
    });

    rerender({ value: 2 });
    expect(result.current).toBe(1);
    rerender({ value: 2 });
    expect(result.current).toBe(1);
    rerender({ value: 3 });
    expect(result.current).toBe(2);
  });

  it("compares by value, not by reference", () => {
    const { result, rerender } = renderHook(({ value }) => useFlashOnChange(value), {
      initialProps: { value: "55 km/h" },
    });
    rerender({ value: "55 km/h" });
    expect(result.current).toBe(0);
  });
});

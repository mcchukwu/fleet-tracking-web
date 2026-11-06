import { describe, expect, it } from "vitest";
import {
  clampVisible,
  isObscured,
  nearestSnap,
  nextSheetSnap,
  sheetMetrics,
  sheetVisible,
  toggleSheetSnap,
} from "./sheet";

describe("sheet geometry", () => {
  it("computes snap heights from the viewport minus the top bar and map strip", () => {
    const tall = sheetMetrics(844);
    expect(tall.available).toBe(716);
    expect(tall.peek).toBe(96);
    expect(tall.half).toBe(358);
    expect(tall.full).toBe(716);

    const short = sheetMetrics(640);
    expect(short.available).toBe(512);
    expect(short.half).toBe(256);
    expect(short.full).toBe(512);
  });

  it("clamps a dragged height between peek and full", () => {
    const metrics = sheetMetrics(844);
    expect(clampVisible(20, metrics)).toBe(96);
    expect(clampVisible(900, metrics)).toBe(716);
    expect(clampVisible(400, metrics)).toBe(400);
  });

  it("snaps to the nearest point", () => {
    const metrics = sheetMetrics(844);
    expect(nearestSnap(100, metrics)).toBe("peek");
    expect(nearestSnap(300, metrics)).toBe("half");
    expect(nearestSnap(600, metrics)).toBe("full");
  });

  it("maps a snap to its visible height", () => {
    const metrics = sheetMetrics(844);
    expect(sheetVisible("peek", metrics)).toBe(96);
    expect(sheetVisible("half", metrics)).toBe(358);
    expect(sheetVisible("full", metrics)).toBe(716);
  });

  it("treats a sheet above 60 percent as obscured", () => {
    const metrics = sheetMetrics(844);
    expect(isObscured(429, metrics)).toBe(false);
    expect(isObscured(431, metrics)).toBe(true);
    expect(isObscured(metrics.full, metrics)).toBe(true);
  });

  it("cycles snaps and remembers the last non-peek snap", () => {
    expect(nextSheetSnap("peek", 1)).toBe("half");
    expect(nextSheetSnap("full", -1)).toBe("half");
    expect(nextSheetSnap("full", 1)).toBe("full");
    expect(toggleSheetSnap("peek", "full")).toBe("full");
    expect(toggleSheetSnap("half", "full")).toBe("peek");
  });
});

import { describe, expect, it } from "vitest";
import {
  GLIDE_CAP_MS,
  GLIDE_SNAP_MS,
  glideDuration,
  glideProgress,
  lerpPosition,
} from "./interpolate";

describe("marker glide", () => {
  it("interpolates linearly", () => {
    expect(lerpPosition([0, 0], [10, 20], 0.5)).toEqual([5, 10]);
    expect(lerpPosition([0, 0], [10, 20], 0)).toEqual([0, 0]);
    expect(lerpPosition([0, 0], [10, 20], 1)).toEqual([10, 20]);
  });

  it("caps the duration at two seconds", () => {
    expect(glideDuration(1_000, 4_000, false)).toBe(GLIDE_CAP_MS);
  });

  it("uses the observed interval when it is shorter than the cap", () => {
    expect(glideDuration(1_000, 1_600, false)).toBe(600);
  });

  it("snaps after ten seconds without an update", () => {
    expect(glideDuration(1_000, 1_000 + GLIDE_SNAP_MS + 1, false)).toBe(0);
    expect(glideDuration(1_000, 1_000 + GLIDE_SNAP_MS - 1, false)).toBe(GLIDE_CAP_MS);
  });

  it("snaps when reduced motion is requested", () => {
    expect(glideDuration(1_000, 1_500, true)).toBe(0);
  });

  it("clamps progress", () => {
    expect(glideProgress(1_000, 900, 200)).toBe(0);
    expect(glideProgress(1_000, 1_100, 200)).toBe(0.5);
    expect(glideProgress(1_000, 1_300, 200)).toBe(1);
    expect(glideProgress(1_000, 1_100, 0)).toBe(1);
  });
});

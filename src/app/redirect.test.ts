import { describe, expect, it } from "vitest";
import { safeRedirect } from "./redirect";

describe("safeRedirect", () => {
  it("allows an in-app path with its query", () => {
    expect(safeRedirect("/map?v=abc&status=moving")).toBe("/map?v=abc&status=moving");
  });

  it("falls back for absolute and protocol-relative URLs", () => {
    expect(safeRedirect("https://evil.example")).toBe("/map");
    expect(safeRedirect("//evil.example")).toBe("/map");
  });

  it("rejects backslashes that browsers treat as separators", () => {
    expect(safeRedirect("/\\evil.example")).toBe("/map");
    expect(safeRedirect("/map\\..\\admin")).toBe("/map");
  });

  it("rejects control characters", () => {
    expect(safeRedirect("/map\nLocation: https://evil.example")).toBe("/map");
    expect(safeRedirect("/map\u0000")).toBe("/map");
  });

  it("uses the fallback when no target is provided", () => {
    expect(safeRedirect(undefined)).toBe("/map");
    expect(safeRedirect(undefined, "/alerts")).toBe("/alerts");
  });
});

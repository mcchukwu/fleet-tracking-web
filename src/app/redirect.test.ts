import { describe, expect, it } from "vitest";
import { safeRedirect } from "./redirect";

describe("safeRedirect", () => {
  it("keeps an internal path with its query string", () => {
    expect(safeRedirect("/map?v=abc&status=moving")).toBe("/map?v=abc&status=moving");
  });

  it("falls back when no target was stored", () => {
    expect(safeRedirect(undefined)).toBe("/map");
  });

  it("rejects protocol-relative and absolute targets", () => {
    expect(safeRedirect("//evil.example/path")).toBe("/map");
    expect(safeRedirect("https://evil.example")).toBe("/map");
    expect(safeRedirect("javascript:alert(1)")).toBe("/map");
  });
});

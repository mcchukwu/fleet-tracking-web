import { describe, expect, it } from "vitest";
import { navForRole } from "./nav";

function paths(role: "admin" | "dispatcher" | "security" | "viewer"): string[] {
  return navForRole(role).map((item) => item.to);
}

const readOnly = ["/map", "/alerts", "/trips", "/drivers", "/geofences", "/reports", "/system"];

describe("navigation by role", () => {
  it("gives an admin every screen", () => {
    expect(paths("admin")).toEqual([
      ...readOnly.slice(0, 5),
      "/import",
      ...readOnly.slice(5),
      "/audit",
    ]);
  });

  it("hides audit from a dispatcher but keeps import", () => {
    expect(paths("dispatcher")).toContain("/import");
    expect(paths("dispatcher")).not.toContain("/audit");
  });

  it("gives security audit but not import", () => {
    expect(paths("security")).toContain("/audit");
    expect(paths("security")).not.toContain("/import");
  });

  it("gives a viewer only read screens", () => {
    expect(paths("viewer")).toEqual(readOnly);
  });

  it("returns no navigation without a role", () => {
    expect(navForRole(undefined)).toEqual([]);
  });
});

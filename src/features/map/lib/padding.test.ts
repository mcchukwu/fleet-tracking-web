import { describe, expect, it } from "vitest";
import { fitPadding } from "./padding";

describe("fitPadding", () => {
  it("reserves the drawer plus two gaps on the right when it is open", () => {
    expect(
      fitPadding({ isDesktop: true, panelOpen: false, sheetSnap: "peek", drawerOpen: true }),
    ).toEqual({ top: 96, right: 444, bottom: 12, left: 12 });
  });

  it("keeps the drawer padding while the panel is open at xl", () => {
    expect(
      fitPadding({ isDesktop: true, panelOpen: true, sheetSnap: "peek", drawerOpen: true }),
    ).toEqual({ top: 96, right: 444, bottom: 12, left: 384 });
  });

  it("follows the visible panel and keeps a 12px right edge with no drawer", () => {
    expect(
      fitPadding({ isDesktop: true, panelOpen: true, sheetSnap: "peek", drawerOpen: false }),
    ).toEqual({ top: 96, right: 12, bottom: 12, left: 384 });
  });

  it("uses the sheet snap on mobile", () => {
    expect(fitPadding({ isDesktop: false, panelOpen: false, sheetSnap: "peek" })).toEqual({
      top: 104,
      right: 12,
      bottom: 125,
      left: 12,
    });
    expect(fitPadding({ isDesktop: false, panelOpen: false, sheetSnap: "half" }).bottom).toBe(300);
    expect(fitPadding({ isDesktop: false, panelOpen: false, sheetSnap: "full" }).bottom).toBe(420);
  });
});

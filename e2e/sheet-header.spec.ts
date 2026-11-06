import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview } from "./helpers";

/**
 * Layout invariants for the mobile vehicles sheet header. Every assertion is a
 * measurement so an alignment, clipping or layering regression fails here
 * instead of waiting for a human to spot it.
 */

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 412, height: 915 },
] as const;
const SNAPS = ["peek", "half", "full"] as const;
const SCROLLS = ["top", "middle", "end"] as const;
const TOLERANCE = 0.5;

type Snap = (typeof SNAPS)[number];
type Scroll = (typeof SCROLLS)[number];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  scrollWidth: number;
  clientWidth: number;
  backgroundColor: string;
  boxSizing: string;
  overflowY: string;
  position: string;
  zIndex: string;
  paddingLeft: string;
  paddingRight: string;
}

interface Layout {
  viewportHeight: number;
  sheet: Box;
  header: Box;
  search: Box;
  searchRow: Box;
  scroller: Box;
  firstRow: Box;
  firstRowContent: Box;
  lastRow: Box | null;
  headerInsideScroller: boolean;
  safeAreaBottom: number;
  sheetPaddingBottom: number;
}

async function readLayout(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    function box(element: Element): {
      x: number;
      y: number;
      width: number;
      height: number;
      right: number;
      bottom: number;
      scrollWidth: number;
      clientWidth: number;
      backgroundColor: string;
      boxSizing: string;
      overflowY: string;
      position: string;
      zIndex: string;
      paddingLeft: string;
      paddingRight: string;
    } {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        backgroundColor: style.backgroundColor,
        boxSizing: style.boxSizing,
        overflowY: style.overflowY,
        position: style.position,
        zIndex: style.zIndex,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
      };
    }

    const sheet = document.querySelector<HTMLElement>(
      'section[aria-label="Vehicles"]',
    );
    const header = document.querySelector<HTMLElement>(
      '[data-testid="sheet-header"]',
    );
    const search = document.querySelector<HTMLElement>(
      '[data-testid="sheet-header"] input[type="search"]',
    );
    const searchRow = header?.children[2];
    const scroller = document.querySelector<HTMLElement>(
      'ul[aria-label="Vehicles"]',
    )?.parentElement;
    const firstRow = document.querySelector<HTMLElement>("[data-vehicle-key]");
    const lastRow =
      [...document.querySelectorAll<HTMLElement>("[data-vehicle-key]")].at(
        -1,
      ) ?? null;
    const firstRowContent =
      firstRow?.querySelector<HTMLElement>("div.pointer-events-none") ?? null;
    const probe = document.createElement("div");
    probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
    document.body.append(probe);
    const safeAreaBottom = Number.parseFloat(
      window.getComputedStyle(probe).paddingBottom,
    );
    probe.remove();

    if (
      !sheet ||
      !header ||
      !search ||
      !searchRow ||
      !scroller ||
      !firstRow ||
      !firstRowContent
    ) {
      throw new Error("The mobile sheet did not render its header and list");
    }

    return {
      viewportHeight: window.innerHeight,
      sheet: box(sheet),
      header: box(header),
      search: box(search),
      searchRow: box(searchRow),
      scroller: box(scroller),
      firstRow: box(firstRow),
      firstRowContent: box(firstRowContent),
      lastRow: lastRow ? box(lastRow) : null,
      headerInsideScroller: scroller.contains(header),
      safeAreaBottom,
      sheetPaddingBottom: Number.parseFloat(
        window.getComputedStyle(sheet).paddingBottom,
      ),
    };
  });
}

async function setSnap(page: Page, snap: Snap): Promise<void> {
  const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
  await handle.focus();
  if (snap === "peek") await page.keyboard.press("Home");
  if (snap === "half") {
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowUp");
  }
  if (snap === "full") await page.keyboard.press("End");
  await expect(handle).toHaveAttribute(
    "aria-expanded",
    snap === "peek" ? "false" : "true",
  );
  await page.waitForTimeout(350);
}

async function setScroll(page: Page, scroll: Scroll): Promise<void> {
  await page.evaluate((mode) => {
    const element = document.querySelector(
      'ul[aria-label="Vehicles"]',
    )?.parentElement;
    if (!element) return;
    if (mode === "top") element.scrollTop = 0;
    if (mode === "middle")
      element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
    if (mode === "end") element.scrollTop = element.scrollHeight;
  }, scroll);
  await page.waitForTimeout(80);
}

function assertInvariants(layout: Layout, snap: Snap, scroll: Scroll): void {
  const {
    sheet,
    header,
    search,
    searchRow,
    scroller,
    firstRow,
    firstRowContent,
    lastRow,
  } = layout;

  // One opaque header region, drawn above the list, outside the scroller.
  expect(header.backgroundColor).toBe(sheet.backgroundColor);
  expect(header.backgroundColor).toMatch(/^rgb\(/);
  expect(header.position).not.toBe("static");
  expect(Number.parseInt(header.zIndex, 10)).toBeGreaterThanOrEqual(1);
  expect(layout.headerInsideScroller).toBe(false);

  // The header separator is the header's own bottom border and spans the sheet.
  expect(Math.abs(header.x - sheet.x)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(header.right - sheet.right)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(header.width - sheet.width)).toBeLessThanOrEqual(TOLERANCE);

  // The search field is contained, border-box and inset 12px on both sides.
  expect(search.boxSizing).toBe("border-box");
  expect(Math.abs(search.x - header.x - 12)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(header.right - search.right - 12)).toBeLessThanOrEqual(
    TOLERANCE,
  );
  expect(search.width).toBeLessThanOrEqual(header.width - 24 + TOLERANCE);
  expect(search.y - searchRow.y).toBeGreaterThanOrEqual(8);
  expect(searchRow.bottom - search.bottom).toBeGreaterThanOrEqual(8);

  // The list starts exactly at the header's bottom edge and clips its rows.
  expect(Math.abs(scroller.y - header.bottom)).toBeLessThanOrEqual(TOLERANCE);
  expect(scroller.overflowY).not.toBe("visible");
  if (scroll === "top") {
    expect(firstRow.y).toBeGreaterThanOrEqual(scroller.y - 1);
  }
  expect(header.bottom).toBeLessThanOrEqual(layout.viewportHeight + TOLERANCE);
  if (snap === "peek") {
    expect(Math.abs(header.bottom - layout.viewportHeight)).toBeLessThanOrEqual(
      TOLERANCE,
    );
  }

  // Row dividers share the separator's x, and row content keeps 12px padding.
  expect(Math.abs(firstRow.x - header.x)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(firstRow.right - header.right)).toBeLessThanOrEqual(
    TOLERANCE,
  );
  expect(Number.parseFloat(firstRowContent.paddingLeft)).toBe(12);
  expect(Number.parseFloat(firstRowContent.paddingRight)).toBe(12);

  // No horizontal overflow in the header or the list.
  expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth);
  expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth);

  // The end of the list is reachable and clear of the safe-area inset.
  if (scroll === "end") {
    if (!lastRow) throw new Error("the list rendered no rows");
    expect(lastRow.bottom).toBeLessThanOrEqual(scroller.bottom + 1);
    expect(lastRow.bottom).toBeLessThanOrEqual(
      scroller.bottom - layout.safeAreaBottom + 1,
    );
  }
}

async function gotoMap(page: Page): Promise<void> {
  await page.goto("/map?map=fake");
  await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
  await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), {
      timeout: 15_000,
    })
    .toBe(true);
  await page.locator("[data-vehicle-key]").first().waitFor();
}

test.describe("mobile sheet header layout", () => {
  for (const viewport of VIEWPORTS) {
    test(`header and list align at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      test.skip(
        (page.viewportSize()?.width ?? 1440) >= 1024,
        "the bottom sheet only exists below lg",
      );
      await page.setViewportSize(viewport);
      await gotoMap(page);

      for (const snap of SNAPS) {
        await setSnap(page, snap);
        for (const scroll of SCROLLS) {
          await setScroll(page, scroll);
          assertInvariants(await readLayout(page), snap, scroll);
        }
        await setScroll(page, "top");
        await captureForReview(
          page,
          `sheet-header-${viewport.width}x${viewport.height}-${snap}`,
        );
      }
    });
  }

  test("the last row clears a bottom safe-area inset", async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 1440) >= 1024,
      "mobile-only layout",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoMap(page);
    await setSnap(page, "full");

    // Chromium reports env(safe-area-inset-bottom) as 0. Apply the inset the
    // way an iOS home indicator does and prove the sheet consumes it.
    await page.addStyleTag({
      content: ".mobile-sheet { padding-bottom: 34px !important; }",
    });
    await setScroll(page, "end");

    const layout = await readLayout(page);
    expect(layout.sheetPaddingBottom).toBe(34);
    expect(layout.scroller.bottom).toBeLessThanOrEqual(
      layout.viewportHeight - 34 + TOLERANCE,
    );
    if (!layout.lastRow) throw new Error("the list rendered no rows");
    expect(layout.lastRow.bottom).toBeLessThanOrEqual(
      layout.scroller.bottom + 1,
    );
  });
});

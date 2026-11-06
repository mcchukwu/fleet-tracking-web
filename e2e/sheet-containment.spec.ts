import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * The mobile sheet is a drawer, not part of the page. Every snap point must end
 * at the viewport bottom, keep the map page non-scrollable, and expose the end
 * of the list inside the sheet — never below the fold.
 */

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
] as const;

const SNAPS = ["peek", "half", "full"] as const;
const TOLERANCE = 1;

type Snap = (typeof SNAPS)[number];

async function gotoMap(page: Page): Promise<void> {
  await page.goto("/map?map=fake&perf=25");
  await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
  await expect(page.getByText(/Showing 25 of 25/)).toBeVisible();
  await page.getByRole("button", { name: /Showing \d+ of \d+/ }).waitFor();
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
  await page.waitForTimeout(400);
}

async function scrollListToEnd(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scroller = document.querySelector(
      'ul[aria-label="Vehicles"]',
    )?.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  await page.waitForTimeout(200);
}

async function readGeometry(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>(
      'section[aria-label="Vehicles"]',
    );
    const main = document.querySelector<HTMLElement>("main");
    const scroller = document.querySelector<HTMLElement>(
      'ul[aria-label="Vehicles"]',
    )?.parentElement;
    const rows = [
      ...document.querySelectorAll<HTMLElement>("[data-vehicle-key]"),
    ];
    if (!sheet || !main || !scroller) {
      throw new Error("The sheet or the map page did not render");
    }
    const sheetRect = sheet.getBoundingClientRect();
    const last = rows.at(-1)?.getBoundingClientRect() ?? null;
    return {
      viewportHeight: window.innerHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      documentClientHeight: document.documentElement.clientHeight,
      mainScrollHeight: main.scrollHeight,
      mainClientHeight: main.clientHeight,
      mainScrollTop: main.scrollTop,
      sheetTop: sheetRect.top,
      sheetBottom: sheetRect.bottom,
      sheetHeight: sheetRect.height,
      scrollerTop: scroller.getBoundingClientRect().top,
      scrollerBottom: scroller.getBoundingClientRect().bottom,
      scrollerHeight: scroller.getBoundingClientRect().height,
      listScrollTop: scroller.scrollTop,
      listMaxScrollTop: scroller.scrollHeight - scroller.clientHeight,
      lastRowTop: last?.top ?? null,
      lastRowBottom: last?.bottom ?? null,
    };
  });
}

test.describe("mobile sheet containment", () => {
  for (const viewport of VIEWPORTS) {
    test(`the drawer stays in the viewport at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      test.skip(
        (page.viewportSize()?.width ?? 1440) >= 1024,
        "the bottom sheet only exists below lg",
      );
      test.setTimeout(60_000);
      await page.setViewportSize(viewport);
      await gotoMap(page);

      for (const snap of SNAPS) {
        await setSnap(page, snap);
        const geometry = await readGeometry(page);

        expect(
          geometry.sheetBottom,
          `${snap}: sheet bottom`,
        ).toBeLessThanOrEqual(geometry.viewportHeight + TOLERANCE);
        expect(
          geometry.sheetBottom,
          `${snap}: sheet reaches the bottom`,
        ).toBeCloseTo(geometry.viewportHeight, 0);
        expect(
          geometry.sheetTop,
          `${snap}: sheet top stays inside the viewport`,
        ).toBeGreaterThanOrEqual(-TOLERANCE);

        // The map page is one fixed screen: the drawer must not add page scroll.
        expect(
          geometry.mainScrollHeight,
          `${snap}: map page scroll height`,
        ).toBeLessThanOrEqual(geometry.mainClientHeight + TOLERANCE);
        expect(
          geometry.documentScrollHeight,
          `${snap}: document scroll height`,
        ).toBeLessThanOrEqual(geometry.documentClientHeight + TOLERANCE);
        expect(geometry.mainScrollTop, `${snap}: map page scrolled`).toBe(0);

        if (snap === "peek") continue;

        // The list is the only scrollable region, and its viewport is exactly
        // the visible part of the sheet, so the last row is reachable.
        expect(
          geometry.scrollerBottom,
          `${snap}: list ends inside the viewport`,
        ).toBeLessThanOrEqual(geometry.viewportHeight + TOLERANCE);
        expect(
          geometry.scrollerHeight,
          `${snap}: list height equals the visible sheet body`,
        ).toBeCloseTo(
          geometry.sheetHeight - (geometry.scrollerTop - geometry.sheetTop),
          0,
        );

        await scrollListToEnd(page);
        const scrolled = await readGeometry(page);
        expect(
          scrolled.listScrollTop,
          `${snap}: list can scroll to its end`,
        ).toBeCloseTo(scrolled.listMaxScrollTop, 0);
        expect(scrolled.lastRowTop, `${snap}: last row top`).not.toBeNull();
        expect(
          scrolled.lastRowBottom ?? Number.POSITIVE_INFINITY,
          `${snap}: last row is visible`,
        ).toBeLessThanOrEqual(geometry.viewportHeight + TOLERANCE);
        expect(
          scrolled.lastRowTop ?? Number.NEGATIVE_INFINITY,
          `${snap}: last row is inside the list viewport`,
        ).toBeGreaterThanOrEqual(scrolled.scrollerTop - TOLERANCE);
      }
    });
  }

  test("dragging the header resizes the drawer without scrolling the page", async ({
    page,
  }) => {
    test.skip(
      (page.viewportSize()?.width ?? 1440) >= 1024,
      "the bottom sheet only exists below lg",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoMap(page);

    const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
    await handle.focus();
    await page.keyboard.press("Home");
    await page.waitForTimeout(150);

    const header = page.getByTestId("sheet-header");
    const headerBox = await header.boundingBox();
    if (!headerBox) throw new Error("The sheet header has no box");

    const x = headerBox.x + headerBox.width / 2;
    const y = headerBox.y + 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 200, { steps: 10 });
    await page.waitForTimeout(150);

    const during = await readGeometry(page);
    expect(
      Math.abs(during.sheetTop - (headerBox.y - 200)),
      "the header tracks the pointer",
    ).toBeLessThanOrEqual(3);
    expect(during.mainScrollTop, "the page scrolls during the drag").toBe(0);
    expect(
      during.mainScrollHeight,
      "the page grows during the drag",
    ).toBeLessThanOrEqual(during.mainClientHeight + TOLERANCE);

    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await readGeometry(page);
    expect(after.sheetBottom, "the sheet settles at the viewport").toBeCloseTo(
      after.viewportHeight,
      0,
    );
    expect(
      after.mainScrollHeight,
      "the page grows after the drag",
    ).toBeLessThanOrEqual(after.mainClientHeight + TOLERANCE);
  });
});

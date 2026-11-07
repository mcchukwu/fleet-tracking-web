import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview } from "./helpers";

/**
 * B11 layout invariants for mobile vehicle rows and the map attribution. Every
 * assertion is a measurement so a centring, clipping, stacking or layering
 * regression fails here instead of waiting for a human to spot it.
 */

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 412, height: 915 },
] as const;
const FLEETS = [1, 3, 25, 5000] as const;
const SNAPS = ["peek", "half", "full"] as const;
const SCROLLS = ["top", "middle", "end"] as const;
const ROW_HEIGHT = 56;
const TOLERANCE = 1;

type Snap = (typeof SNAPS)[number];
type Scroll = (typeof SCROLLS)[number];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  fontSize: string;
  lineHeight: string;
  whiteSpace: string;
  paddingTop: string;
  paddingBottom: string;
  opacity: string;
}

interface Layout {
  viewportHeight: number;
  sheet: Box;
  sheetBottom: number;
  header: Box;
  scroller: Box;
  listHeight: number;
  rows: Array<{
    box: Box;
    content: Box;
    contentCentre: number;
    paddingTop: string;
    paddingBottom: string;
    justify: string;
    divider: Box;
    contentTop: number;
    contentBottom: number;
    inlineAction: { width: number; height: number };
  }>;
  controls: Box;
  attribution: Box;
  attributionText: string;
  attributionLines: number;
  safeBottom: number;
  sheetPaddingBottom: number;
  vehicleCount: number;
  harness: Box | null;
  panel: Box | null;
}

async function readLayout(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    function box(element: Element): Box {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        whiteSpace: style.whiteSpace,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        opacity: style.opacity,
      };
    }

    const sheet = document.querySelector<HTMLElement>(
      'section[aria-label="Vehicles"]',
    );
    const header = document.querySelector<HTMLElement>(
      '[data-testid="sheet-header"]',
    );
    const list = document.querySelector<HTMLElement>(
      'ul[aria-label="Vehicles"]',
    );
    const scroller = list?.parentElement ?? null;
    const controls = document.querySelector<HTMLElement>(
      'fieldset[aria-label="Map controls"]',
    );
    const attribution = document.querySelector<HTMLElement>(
      '[data-testid="map-attribution"]',
    );
    const harness = document.querySelector<HTMLElement>(
      '[data-testid="map-inset-harness"]',
    );
    const panel = document.querySelector<HTMLElement>("aside");

    if (!sheet || !header || !scroller || !list || !controls || !attribution) {
      throw new Error("The mobile sheet or the map footer did not render");
    }

    const probe = document.createElement("div");
    probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
    document.body.append(probe);
    const safeBottom = Number.parseFloat(
      window.getComputedStyle(probe).paddingBottom,
    );
    probe.remove();

    const attributionStyle = window.getComputedStyle(attribution);
    const lineHeight = Number.parseFloat(attributionStyle.lineHeight);
    const range = document.createRange();
    range.selectNodeContents(attribution);
    const attributionLines =
      lineHeight > 0
        ? Math.max(
            1,
            Math.round(range.getBoundingClientRect().height / lineHeight),
          )
        : 0;

    const rows = [
      ...document.querySelectorAll<HTMLElement>("[data-vehicle-key]"),
    ].map((row) => {
      const content = row.querySelector<HTMLElement>("div.pointer-events-none");
      const divider = row.querySelector<HTMLElement>(
        '[data-testid="row-divider"]',
      );
      if (!content || !divider)
        throw new Error("A vehicle row is missing its content or divider");
      const lines = [...content.children].map((child) =>
        child.getBoundingClientRect(),
      );
      const contentBox = box(content);
      return {
        box: box(row),
        content: contentBox,
        contentCentre: contentBox.y + contentBox.height / 2,
        paddingTop: contentBox.paddingTop,
        paddingBottom: contentBox.paddingBottom,
        justify: window.getComputedStyle(content).justifyContent,
        divider: box(divider),
        contentTop: lines[0]?.top ?? contentBox.y,
        contentBottom: lines[lines.length - 1]?.bottom ?? contentBox.bottom,
        inlineAction: (() => {
          const action = row.querySelector<HTMLElement>(
            "[data-row-inline-action] button",
          );
          if (!action)
            throw new Error("A vehicle row is missing its inline action");
          const rect = action.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        })(),
      };
    });

    const sheetRect = sheet.getBoundingClientRect();
    return {
      viewportHeight: window.innerHeight,
      sheet: box(sheet),
      sheetBottom: sheetRect.bottom,
      header: box(header),
      scroller: box(scroller),
      listHeight: Number.parseFloat(list.style.height),
      rows,
      controls: box(controls),
      attribution: box(attribution),
      attributionText: attribution.textContent?.trim() ?? "",
      attributionLines,
      safeBottom,
      sheetPaddingBottom: Number.parseFloat(
        window.getComputedStyle(sheet).paddingBottom,
      ),
      vehicleCount: Number(sheet.dataset.vehicleCount ?? ""),
      harness: harness ? box(harness) : null,
      panel: panel ? box(panel) : null,
    };
  });
}

function overlap(a: Box, b: Box): boolean {
  return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
}

function assertRows(layout: Layout, scroll: Scroll, snap: Snap): void {
  const { rows } = layout;
  expect(layout.vehicleCount).toBeGreaterThan(0);

  // The peek snap is exactly one header tall (113px), so the peek can never
  // expose list rows or push the search field off screen.
  if (snap === "peek") {
    expect(layout.header.height, "peek header height").toBeCloseTo(113, 0);
    expect(layout.viewportHeight - layout.sheet.y, "peek height").toBeCloseTo(
      113,
      0,
    );

    // A collapsed sheet has no list viewport, so the virtualiser renders no
    // rows. The list region is exactly the header's height: zero.
    expect(rows, "peek renders list rows").toHaveLength(0);
    const peekInset = Math.max(layout.safeBottom, layout.sheetPaddingBottom);
    expect(layout.scroller.y, "peek list top").toBeCloseTo(
      layout.header.bottom,
      0,
    );
    expect(layout.scroller.bottom, "peek list bottom").toBeCloseTo(
      layout.sheetBottom - peekInset,
      0,
    );
    expect(layout.listHeight, "peek virtual total").toBeCloseTo(
      layout.vehicleCount * ROW_HEIGHT,
      0,
    );
    return;
  }

  expect(rows.length).toBeGreaterThan(0);

  // Every row is 56px, consecutive rows touch, and the virtual total is measured.
  for (const [index, row] of rows.entries()) {
    expect(row.box.height, `row ${index} height`).toBeCloseTo(ROW_HEIGHT, 0);
    const next = rows[index + 1];
    if (next) {
      expect(
        row.box.bottom,
        `row ${index} touches row ${index + 1}`,
      ).toBeCloseTo(next.box.y, 0);
    }

    // Content fills the row, is centred and has symmetrical padding.
    expect(row.content.y, `row ${index} content top`).toBeCloseTo(row.box.y, 0);
    expect(row.content.height, `row ${index} content height`).toBeCloseTo(
      ROW_HEIGHT,
      0,
    );
    expect(row.contentCentre, `row ${index} content centre`).toBeCloseTo(
      row.box.y + row.box.height / 2,
      0,
    );
    expect(row.justify, `row ${index} justify`).toBe("center");
    expect(row.paddingTop, `row ${index} top padding`).toBe(row.paddingBottom);
    expect(
      row.contentTop - row.box.y,
      `row ${index} line group top`,
    ).toBeCloseTo(row.box.bottom - row.contentBottom, 0);
    expect(
      row.divider.y - row.contentBottom,
      `row ${index} space above the divider`,
    ).toBeGreaterThanOrEqual(6 - TOLERANCE);
    expect(
      row.inlineAction.height,
      `row ${index} inline action height`,
    ).toBeGreaterThanOrEqual(44);
    expect(
      row.inlineAction.width,
      `row ${index} inline action width`,
    ).toBeGreaterThanOrEqual(44);

    // The divider is a 1px line on the row's bottom edge, spanning its width.
    expect(row.divider.height, `row ${index} divider height`).toBeCloseTo(1, 0);
    expect(row.divider.bottom, `row ${index} divider bottom`).toBeCloseTo(
      row.box.bottom,
      0,
    );
    expect(row.divider.x, `row ${index} divider left`).toBeCloseTo(
      layout.header.x,
      0,
    );
    expect(row.divider.right, `row ${index} divider right`).toBeCloseTo(
      layout.header.right,
      0,
    );
  }

  expect(layout.listHeight, "virtual total").toBeCloseTo(
    layout.vehicleCount * ROW_HEIGHT,
    0,
  );

  // The list starts at the header's bottom and fills down to the sheet's bottom.
  const bottomInset = Math.max(layout.safeBottom, layout.sheetPaddingBottom);
  expect(layout.scroller.y, "list top").toBeCloseTo(layout.header.bottom, 0);
  expect(layout.scroller.bottom, "list bottom").toBeCloseTo(
    layout.sheetBottom - bottomInset,
    0,
  );
  expect(layout.scroller.height, "list height").toBeCloseTo(
    layout.sheet.height - layout.header.height - bottomInset,
    0,
  );

  // Scrolling to the end leaves 12px plus the safe-area inset below the last row.
  if (scroll === "end") {
    const last = rows[rows.length - 1];
    expect(last, "last row").toBeDefined();
    if (!last) return;
    const below = layout.sheetBottom - last.box.bottom;
    expect(below, "space below the last row").toBeGreaterThanOrEqual(
      12 + bottomInset - TOLERANCE,
    );
    expect(last.box.bottom, "last row inside the list").toBeLessThanOrEqual(
      layout.scroller.bottom + TOLERANCE,
    );
  }
}

function assertAttribution(layout: Layout, snap: Snap): void {
  const { attribution, controls } = layout;

  expect(layout.attributionLines, "attribution wraps").toBe(1);
  expect(attribution.fontSize, "attribution font size").toBe("11px");
  expect(attribution.whiteSpace, "attribution white space").toBe("nowrap");
  expect(layout.attributionText, "attribution copy").toMatch(
    /OpenStreetMap.*(Protomaps|OpenFreeMap)/,
  );

  // Directly below the controls, right-aligned, with an 8px gap.
  expect(
    attribution.y - controls.bottom,
    "gap below controls",
  ).toBeGreaterThanOrEqual(8 - TOLERANCE);
  expect(attribution.right, "attribution right edge").toBeCloseTo(
    controls.right,
    0,
  );

  // Above the sheet at every snap, and clear of the other floating surfaces.
  expect(attribution.bottom, "attribution above the sheet").toBeLessThanOrEqual(
    layout.sheet.y + TOLERANCE,
  );
  expect(
    overlap(attribution, layout.sheet),
    "attribution overlaps the sheet",
  ).toBe(false);
  if (layout.harness) {
    expect(
      overlap(attribution, layout.harness),
      "attribution overlaps the harness",
    ).toBe(false);
  }
  if (layout.panel) {
    expect(
      overlap(attribution, layout.panel),
      "attribution overlaps the panel",
    ).toBe(false);
  }

  // The credit survives the controls hiding above 60% sheet height.
  if (snap === "full") {
    expect(Number.parseFloat(controls.opacity), "controls opacity").toBe(0);
    expect(Number.parseFloat(attribution.opacity), "attribution opacity").toBe(
      1,
    );
  }
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
  await page.waitForTimeout(150);
}

async function gotoFleet(page: Page, fleet: number): Promise<void> {
  await page.goto(`/map?map=fake&perf=${fleet}`);
  await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
  await expect(
    page.getByText(new RegExp(`Showing ${fleet} of ${fleet}`)),
  ).toBeVisible();
  await page.getByRole("button", { name: /Showing \d+ of \d+/ }).waitFor();
  await page.evaluate((count) => {
    const sheet = document.querySelector<HTMLElement>(
      'section[aria-label="Vehicles"]',
    );
    if (sheet) sheet.dataset.vehicleCount = String(count);
  }, fleet);
}

test.describe("mobile sheet rows and attribution", () => {
  for (const viewport of VIEWPORTS) {
    test(`rows line up at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      test.skip(
        (page.viewportSize()?.width ?? 1440) >= 1024,
        "the bottom sheet only exists below lg",
      );
      test.setTimeout(180_000);
      await page.setViewportSize(viewport);

      for (const fleet of FLEETS) {
        await gotoFleet(page, fleet);
        for (const snap of SNAPS) {
          await setSnap(page, snap);
          for (const scroll of SCROLLS) {
            await setScroll(page, scroll);
            const layout = await readLayout(page);
            assertRows(layout, scroll, snap);
            assertAttribution(layout, snap);
          }
        }
        await setSnap(page, "full");
        await setScroll(page, "end");
        await captureForReview(
          page,
          `sheet-rows-${viewport.width}x${viewport.height}-fleet-${fleet}`,
        );
      }

      await gotoFleet(page, 25);
      await setSnap(page, "peek");
      await setScroll(page, "top");
      await captureForReview(
        page,
        `sheet-rows-${viewport.width}x${viewport.height}-peek`,
      );
    });
  }

  test("the last row clears a bottom safe-area inset", async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 1440) >= 1024,
      "mobile-only layout",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoFleet(page, 25);
    await setSnap(page, "full");

    // Chromium reports env(safe-area-inset-bottom) as 0. Apply the inset the
    // way an iOS home indicator does and prove the sheet consumes it.
    await page.addStyleTag({
      content: ".mobile-sheet { padding-bottom: 34px !important; }",
    });
    await setScroll(page, "end");
    const layout = await readLayout(page);
    assertRows(layout, "end", "full");
    assertAttribution(layout, "full");
  });
});

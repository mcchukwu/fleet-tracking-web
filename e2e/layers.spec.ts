import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoHorizontalScroll } from "./helpers";

/**
 * The layer model: one banner in flow, one overlay root, one z-index scale.
 * Every assertion here is a measurement, because the agent cannot see the UI.
 */

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
] as const;

const BANNERS = [
  "offline",
  "unavailable",
  "storm",
  "reconnecting",
  "update",
  "session-expired",
] as const;

type BannerKind = (typeof BANNERS)[number];

const TOLERANCE = 1;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  bottom: number;
}

async function gotoMap(page: Page): Promise<void> {
  await page.goto("/map?map=fake");
  await page.getByRole("region", { name: "Live map" }).waitFor();
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), {
      timeout: 15_000,
    })
    .toBe(true);
}

async function isDesktop(page: Page): Promise<boolean> {
  return (page.viewportSize()?.width ?? 1440) >= 1024;
}

async function openDrawer(page: Page): Promise<void> {
  if (!(await isDesktop(page))) {
    const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
    await handle.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowUp");
  }
  await page.getByRole("button", { name: "Select LSD-100-AA" }).click();
  if (await isDesktop(page)) {
    await expect(page.getByTestId("drawer")).toBeVisible();
  } else {
    await expect(page.getByTestId("vehicle-detail-sheet")).toBeVisible();
  }
  // The detail query must settle before the storm banner is raised: a later
  // successful query legitimately clears a storm.
  await expect(page.getByText("Vehicle details", { exact: true })).toBeVisible();
}

async function openUserMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Account menu for/ }).click();
  await expect(page.getByRole("menu")).toBeVisible();
}

async function forceBanner(page: Page, kind: BannerKind): Promise<void> {
  await page.evaluate(
    ({ value }) => {
      window.__FLEET_TEST_CONNECTION__?.({
        network: "online",
        socket: "down",
        socketDownAt: null,
      });
      window.__FLEET_TEST_STORM__?.(false);
      if (value === "offline") {
        window.__FLEET_TEST_CONNECTION__?.({ network: "offline" });
      } else if (value === "reconnecting") {
        window.__FLEET_TEST_CONNECTION__?.({
          socket: "reconnecting",
          socketDownAt: Date.now() - 11_000,
        });
      } else if (value === "unavailable") {
        window.__FLEET_TEST_CONNECTION__?.({
          socket: "reconnecting",
          socketDownAt: Date.now() - 61_000,
        });
      } else if (value === "storm") {
        window.__FLEET_TEST_STORM__?.(true);
      } else if (value === "update") {
        window.dispatchEvent(new CustomEvent("fleet:update-available"));
      } else if (value === "session-expired") {
        window.dispatchEvent(new CustomEvent("fleet:session-expired"));
      }
    },
    { value: kind },
  );
  await expect(page.getByTestId("banner-region")).toHaveAttribute("data-banner-kind", kind);
  await page.waitForTimeout(350);
}

async function clearBanner(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__FLEET_TEST_CONNECTION__?.({
      network: "online",
      socket: "down",
      socketDownAt: null,
    });
    window.__FLEET_TEST_STORM__?.(false);
  });
  await expect(page.getByTestId("banner-region")).toHaveAttribute("data-visible", "false");
  await page.waitForTimeout(350);
}

async function boxes(page: Page): Promise<{
  banner: Box | null;
  content: Box;
  elements: Record<string, Box | null>;
}> {
  return page.evaluate(() => {
    const box = (element: Element | null): Box | null => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
      };
    };
    const banner = document.querySelector<HTMLElement>('[data-testid="banner-region"] output');
    const content = document.querySelector<HTMLElement>('[data-testid="content-area"]');
    const contentBox = box(content);
    if (!content || !contentBox) throw new Error("content area missing");
    const selectors: Record<string, Element | null> = {
      drawer: document.querySelector('[data-testid="drawer"]'),
      sheet: document.querySelector(
        'section[aria-label="Vehicles"], [data-testid="vehicle-detail-sheet"]',
      ),
      panel: document.querySelector('[data-testid="map-root"] aside'),
      kpi: document.querySelector('[data-testid="map-root"] .map-kpi'),
      controls: document.querySelector('fieldset[aria-label="Map controls"]'),
      attribution: document.querySelector('[data-testid="map-attribution"]'),
    };
    return {
      banner: box(banner),
      content: contentBox,
      elements: Object.fromEntries(
        Object.entries(selectors).map(([key, element]) => [key, box(element)]),
      ),
    };
  });
}

test.describe("layers", { tag: "@theme" }, () => {
  for (const viewport of VIEWPORTS) {
    test(`a banner never overlaps content at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);

      for (const kind of BANNERS) {
        await gotoMap(page);
        await openDrawer(page);
        if (kind === "session-expired") await openUserMenu(page);
        await forceBanner(page, kind);

        const measured = await boxes(page);
        const banner = measured.banner;
        expect(banner, `${kind}: banner has a box`).not.toBeNull();
        if (!banner) continue;

        expect(banner.bottom, `${kind}: banner ends at the content top`).toBeLessThanOrEqual(
          measured.content.y + TOLERANCE,
        );
        expect(measured.content.y, `${kind}: content starts at the banner bottom`).toBeCloseTo(
          banner.bottom,
          0,
        );
        expect(
          measured.content.y + measured.content.height,
          `${kind}: content reaches the viewport bottom`,
        ).toBeCloseTo(viewport.height, 0);

        for (const [name, element] of Object.entries(measured.elements)) {
          if (!element) continue;
          expect(element.y, `${kind}: ${name} starts below the banner`).toBeGreaterThanOrEqual(
            banner.bottom - TOLERANCE,
          );
        }
        if (kind === "offline" || kind === "session-expired") {
          await captureForReview(page, `layers-banner-${kind}`);
        }
        await expectNoHorizontalScroll(page);
      }
    });

    test(`a banner does not move the map centre at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await gotoMap(page);

      const before = await page.evaluate(() => ({
        centre: window.__FLEET_TEST_MAP__?.getViewport().center ?? null,
        contentHeight:
          document.querySelector('[data-testid="content-area"]')?.getBoundingClientRect().height ??
          0,
      }));
      expect(before.centre).not.toBeNull();

      await forceBanner(page, "offline");
      const shown = await boxes(page);
      const after = await page.evaluate(() => ({
        centre: window.__FLEET_TEST_MAP__?.getViewport().center ?? null,
        contentHeight:
          document.querySelector('[data-testid="content-area"]')?.getBoundingClientRect().height ??
          0,
      }));

      expect(shown.banner).not.toBeNull();
      if (!shown.banner) return;
      expect(
        before.contentHeight - after.contentHeight,
        "content shrinks by exactly the banner height",
      ).toBeCloseTo(shown.banner.height, 0);
      expect(after.centre?.[0]).toBeCloseTo(before.centre?.[0] ?? 0, 6);
      expect(after.centre?.[1]).toBeCloseTo(before.centre?.[1] ?? 0, 6);

      await clearBanner(page);
      const restored = await page.evaluate(() => ({
        contentHeight:
          document.querySelector('[data-testid="content-area"]')?.getBoundingClientRect().height ??
          0,
      }));
      expect(restored.contentHeight).toBeCloseTo(before.contentHeight, 0);
      await expectNoHorizontalScroll(page);
    });

    test(`the user menu stays above every banner at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);

      for (const kind of BANNERS) {
        // Session expiry is the one blocking banner: its dialog owns input, so a
        // menu cannot stay open. The banner-in-flow check covers it instead.
        if (kind === "session-expired") continue;
        await gotoMap(page);
        await forceBanner(page, kind);
        await openUserMenu(page);

        const result = await page.evaluate(() => {
          const menu = document.querySelector<HTMLElement>('[role="menu"]');
          if (!menu) return null;
          const rect = menu.getBoundingClientRect();
          const inset = 2;
          const points = [
            { x: rect.left + inset, y: rect.top + inset },
            { x: rect.right - inset, y: rect.top + inset },
            { x: rect.left + inset, y: rect.bottom - inset },
            { x: rect.right - inset, y: rect.bottom - inset },
          ];
          return {
            inside:
              rect.left >= 0 &&
              rect.top >= 0 &&
              rect.right <= window.innerWidth &&
              rect.bottom <= window.innerHeight,
            corners: points.map((point) => {
              const hit = document.elementFromPoint(point.x, point.y);
              return hit !== null && menu.contains(hit);
            }),
          };
        });

        expect(result, `${kind}: menu is open`).not.toBeNull();
        expect(result?.inside, `${kind}: menu is fully visible`).toBe(true);
        expect(result?.corners, `${kind}: every menu corner is the menu`).toEqual([
          true,
          true,
          true,
          true,
        ]);
      }
    });
  }

  test("the page drawer starts below a banner on every screen", async ({ page }) => {
    test.setTimeout(120_000);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto("/alerts?map=fake&alert=fbad9142-c164-463d-ae76-3262f2d3b4f9");
      const drawer = page.getByRole("complementary", { name: "Alert details" });
      await expect(drawer).toBeVisible();
      await forceBanner(page, "offline");

      const measured = await page.evaluate(() => {
        const banner = document
          .querySelector('[data-testid="banner-region"] output')
          ?.getBoundingClientRect();
        const panel = document.querySelector('[data-testid="drawer"]')?.getBoundingClientRect();
        if (!banner || !panel) return null;
        return { bannerBottom: banner.bottom, drawerTop: panel.top };
      });
      expect(measured).not.toBeNull();
      expect(
        measured?.drawerTop ?? 0,
        `${viewport.width}x${viewport.height}: drawer starts below the banner`,
      ).toBeGreaterThanOrEqual((measured?.bannerBottom ?? 0) - TOLERANCE);
      if (viewport.width === 1440) {
        await captureForReview(page, "layers-page-drawer");
      }
      await expectNoHorizontalScroll(page);
    }
  });

  test("the layer scale paints drawer < topbar < dialog < popover < toast < tooltip", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto("/dev/layers");
      await page.getByRole("heading", { name: "Layer stack" }).waitFor();

      const top = await page.evaluate(() => {
        const hit = document.elementFromPoint(100, 24);
        return hit?.closest("[data-testid^='layer-swatch-']")?.getAttribute("data-testid") ?? null;
      });
      expect(top, "the tooltip is the top layer").toBe("layer-swatch-tooltip");

      for (const name of ["tooltip", "toast", "popover", "dialog"]) {
        await page.evaluate((layer) => {
          const element = document.querySelector<HTMLElement>(
            `[data-testid="layer-swatch-${layer}"]`,
          );
          if (element) element.style.display = "none";
        }, name);
        const next = await page.evaluate(() => {
          const hit = document.elementFromPoint(100, 24);
          if (!hit) return null;
          const swatch = hit.closest("[data-testid^='layer-swatch-']");
          if (swatch) return swatch.getAttribute("data-testid") ?? null;
          return hit.closest("header") ? "topbar" : null;
        });
        const expected =
          name === "tooltip"
            ? "layer-swatch-toast"
            : name === "toast"
              ? "layer-swatch-popover"
              : name === "popover"
                ? "layer-swatch-dialog"
                : "topbar";
        expect(next, `after hiding ${name}`).toBe(expected);
      }

      await page.evaluate(() => {
        const header = document.querySelector<HTMLElement>("header");
        if (header) header.style.display = "none";
      });
      const drawer = await page.evaluate(() => {
        const hit = document.elementFromPoint(100, 24);
        return hit?.closest("[data-testid='layer-swatch-drawer']") !== null;
      });
      expect(drawer, "the drawer sits below the top bar").toBe(true);
      if (viewport.width === 1440) {
        await captureForReview(page, "layers-dev-order");
      }
    }
  });

  test("a combobox list inside a dialog is above the dialog and its footer", async ({ page }) => {
    await gotoMap(page);
    await openDrawer(page);
    if (!(await isDesktop(page))) {
      await page.keyboard.press("End");
      await page.waitForTimeout(250);
    }
    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.getByRole("combobox", { name: "Driver" }).click();
    const list = page.locator("[data-combobox-list]");
    await expect(list).toBeVisible();

    const sheet = page.locator("[data-picker-sheet]");
    if ((await sheet.count()) > 0) {
      // The sheet presentation is modal: it is portalled above the dialog and
      // covers the dialog's own close by design, offering its own instead.
      const layering = await page.evaluate(() => {
        const sheetElement = document.querySelector<HTMLElement>("[data-picker-sheet]");
        const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
        const parentDialog = dialogs.find((dialog) => !dialog.contains(sheetElement));
        if (!sheetElement || !parentDialog) return null;
        const sheetLayer = sheetElement.closest<HTMLElement>("[data-layer-portal]");
        const dialogLayer = parentDialog.closest<HTMLElement>("[data-layer-portal]");
        return {
          sheetZ: sheetLayer ? Number(getComputedStyle(sheetLayer).zIndex) : 0,
          dialogZ: dialogLayer ? Number(getComputedStyle(dialogLayer).zIndex) : 0,
        };
      });
      expect(layering).not.toBeNull();
      expect(layering?.sheetZ).toBeGreaterThan(layering?.dialogZ ?? 0);
      const close = sheet.getByRole("button", { name: "Close picker" });
      await expect(close).toBeVisible();
      const closeBox = await close.boundingBox();
      expect(closeBox).not.toBeNull();
      if (closeBox) {
        const hit = await page.evaluate(
          ({ x, y }) =>
            document.elementFromPoint(x, y)?.closest('[aria-label="Close picker"]') !== null,
          {
            x: closeBox.x + closeBox.width / 2,
            y: closeBox.y + closeBox.height / 2,
          },
        );
        expect(hit, "the sheet close is hit-testable").toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      await expect(dialog).toBeVisible();
      await captureForReview(page, "layers-dialog-combobox");
      await expectNoHorizontalScroll(page);
      return;
    }

    const layering = await page.evaluate(() => {
      const listElement = document.querySelector<HTMLElement>("[data-combobox-list]");
      const dialogElement = document.querySelector<HTMLElement>('[role="dialog"]');
      if (!listElement || !dialogElement) return null;
      const listLayer = listElement.closest<HTMLElement>("[data-layer-portal]");
      const dialogLayer = dialogElement.closest<HTMLElement>("[data-layer-portal]");
      const footer = dialogElement.querySelector<HTMLElement>(":scope > div:last-child");
      const listRect = listElement.getBoundingClientRect();
      const footerRect = footer?.getBoundingClientRect() ?? null;
      const overlapTop = footerRect ? Math.max(listRect.top, footerRect.top) : null;
      const hitAtList = document.elementFromPoint(
        listRect.left + listRect.width / 2,
        listRect.top + Math.min(listRect.height / 2, 24),
      );
      const hitAtFooter =
        footerRect && overlapTop !== null && overlapTop < listRect.bottom
          ? document.elementFromPoint(listRect.left + listRect.width / 2, overlapTop + 2)
          : null;
      return {
        listZ: listLayer ? Number(getComputedStyle(listLayer).zIndex) : 0,
        dialogZ: dialogLayer ? Number(getComputedStyle(dialogLayer).zIndex) : 0,
        footerZ: footer ? getComputedStyle(footer).zIndex : null,
        portalled: listLayer !== null && dialogLayer !== null,
        hitAtList:
          hitAtList !== null && (hitAtList === listElement || listElement.contains(hitAtList)),
        overlapping: hitAtFooter !== null,
        hitAtFooter:
          hitAtFooter === null || hitAtFooter === listElement || listElement.contains(hitAtFooter),
      };
    });

    expect(layering).not.toBeNull();
    expect(layering?.portalled, "the list and dialog use layer portals").toBe(true);
    expect(layering?.listZ).toBeGreaterThan(layering?.dialogZ ?? 0);
    expect(layering?.footerZ, "the footer has no z-index of its own").toBe("auto");
    expect(layering?.hitAtList, "the list receives the pointer").toBe(true);
    expect(layering?.hitAtFooter, "where the list overlaps the footer, the list wins").toBe(true);
    await captureForReview(page, "layers-dialog-combobox");
    await expectNoHorizontalScroll(page);
  });

  test("the sheet and attribution rules hold with a banner", async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 1440) >= 1024,
      "the bottom sheet only exists below lg",
    );
    await gotoMap(page);
    await forceBanner(page, "offline");

    const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
    await handle.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(250);

    const half = await page.evaluate(() => {
      const sheet = document.querySelector<HTMLElement>('section[aria-label="Vehicles"]');
      const footer = document.querySelector<HTMLElement>('[data-testid="map-footer"]');
      const attribution = document.querySelector<HTMLElement>('[data-testid="map-attribution"]');
      if (!sheet || !footer || !attribution) return null;
      const sheetBox = sheet.getBoundingClientRect();
      const footerBox = footer.getBoundingClientRect();
      const attributionBox = attribution.getBoundingClientRect();
      const hit = document.elementFromPoint(
        attributionBox.left + attributionBox.width / 2,
        attributionBox.top + attributionBox.height / 2,
      );
      return {
        sheetTop: sheetBox.top,
        footerBottom: footerBox.bottom,
        attributionVisible:
          attributionBox.top >= 0 &&
          attributionBox.bottom <= window.innerHeight &&
          hit !== null &&
          attribution.contains(hit),
      };
    });
    expect(half).not.toBeNull();
    expect(half?.footerBottom ?? 0).toBeCloseTo((half?.sheetTop ?? 0) - 12, 0);
    expect(half?.attributionVisible, "attribution is visible above the sheet").toBe(true);

    await page.keyboard.press("End");
    await page.waitForTimeout(250);
    const full = await page.evaluate(() => {
      const sheet = document.querySelector<HTMLElement>('section[aria-label="Vehicles"]');
      const banner = document.querySelector<HTMLElement>('[data-testid="banner-region"]');
      const attribution = document.querySelector<HTMLElement>('[data-testid="map-attribution"]');
      if (!sheet || !banner || !attribution) return null;
      const sheetBox = sheet.getBoundingClientRect();
      const bannerBox = banner.getBoundingClientRect();
      const attributionBox = attribution.getBoundingClientRect();
      return {
        strip: sheetBox.top - bannerBox.bottom,
        attributionVisible:
          attributionBox.top >= bannerBox.bottom && attributionBox.bottom <= window.innerHeight,
      };
    });
    expect(full).not.toBeNull();
    expect(full?.strip, "the full snap leaves an 80px map strip").toBeCloseTo(80, 0);
    expect(full?.attributionVisible, "attribution stays visible at full").toBe(true);
    await captureForReview(page, "layers-sheet-full-banner");
    await expectNoHorizontalScroll(page);
  });
});

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectTouchTargets,
} from "./helpers";

function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 1024;
}

async function gotoMap(page: Page, search = ""): Promise<void> {
  await page.goto(`/map?map=fake${search ? `&${search}` : ""}`);
  await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
  await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), { timeout: 15_000 })
    .toBe(true);
}

function controls(page: Page) {
  return page.locator('fieldset[aria-label="Map controls"]');
}

function sheet(page: Page) {
  return page.getByRole("region", { name: "Vehicles" });
}

function attribution(page: Page) {
  return page.getByTestId("map-attribution");
}

function logo(page: Page) {
  return page.getByTestId("maptiler-logo");
}

function summary(page: Page) {
  return page.getByLabel("Fleet summary");
}

async function debugMap(page: Page) {
  return page.evaluate(() => window.__FLEET_DEBUG__?.map ?? null);
}

test.describe("map controls", () => {
  test("desktop controls zoom, fit, toggle geofences and the panel", async ({ page }) => {
    test.skip(isMobile(page), "desktop-only controls");
    await gotoMap(page);

    const before = (await debugMap(page))?.viewport?.zoom ?? 0;
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect
      .poll(async () => (await debugMap(page))?.viewport?.zoom ?? 0)
      .toBeGreaterThan(before);

    const zoomed = (await debugMap(page))?.viewport?.zoom ?? 0;
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect
      .poll(async () => (await debugMap(page))?.viewport?.zoom ?? 0)
      .toBeLessThan(zoomed);

    const fitCount = (await debugMap(page))?.fitCount ?? 0;
    await page.getByRole("button", { name: "Fit the fleet" }).click();
    await expect
      .poll(async () => (await debugMap(page))?.fitCount ?? 0)
      .toBeGreaterThan(fitCount);

    await page.getByRole("button", { name: "Hide geofences" }).click();
    await expect.poll(async () => (await debugMap(page))?.geofenceCount).toBe(0);
    await page.getByRole("button", { name: "Show geofences" }).click();
    await expect.poll(async () => (await debugMap(page))?.geofenceCount).toBe(4);

    await page.getByRole("button", { name: "Hide the vehicle panel" }).first().click();
    await expect(sheet(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Show the vehicle panel" }).click();
    await expect(sheet(page)).toBeVisible();

    await page.getByRole("button", { name: /Reset bearing to north/ }).click();
    await expect.poll(async () => (await debugMap(page))?.bearing).toBe(0);
    await captureForReview(page, "02b-map-controls-desktop");
  });

  test("desktop controls never overlap the KPI, panel or attribution", { tag: "@theme" }, async ({ page }) => {
    test.skip(isMobile(page), "desktop-only layout");
    await gotoMap(page);

    await expectNoOverlap(controls(page), summary(page));
    await expectNoOverlap(controls(page), sheet(page));
    await expectNoOverlap(controls(page), attribution(page));
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test("the real drawer shifts the controls and keeps every panel clear", async ({ page }) => {
    test.skip(isMobile(page), "desktop-only layout");
    for (const width of [1024, 1440] as const) {
      await page.setViewportSize({ width, height: 900 });
      await gotoMap(page);
      const before = await controls(page).boundingBox();

      await page.goto(`/map?map=fake&v=4324a768-9b14-4223-a299-eb8da4d8d309`);
      await expect
        .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), {
          timeout: 15_000,
        })
        .toBe(true);
      const drawer = page.getByTestId("drawer");
      await expect(drawer).toBeVisible();
      await expect(page.getByTestId("map-root")).toHaveAttribute("data-drawer-open", "true");
      const shifted = await controls(page).boundingBox();

      expect(before).not.toBeNull();
      expect(shifted).not.toBeNull();
      if (!before || !shifted) return;
      expect(Math.round(before.x - shifted.x)).toBe(432);
      await page.waitForTimeout(300);

      const footer = page.getByTestId("map-footer");
      await expect(footer).toHaveCSS("transition-property", "transform");
      await expect(footer).toHaveCSS("right", "12px");

      const controlBox = await controls(page).boundingBox();
      const attributionBox = await attribution(page).boundingBox();
      if (!controlBox || !attributionBox) throw new Error("missing boxes");
      expect(attributionBox.y).toBeGreaterThanOrEqual(
        controlBox.y + controlBox.height - 1,
      );
      expect(
        Math.abs(
          attributionBox.x +
            attributionBox.width -
            (controlBox.x + controlBox.width),
        ),
      ).toBeLessThanOrEqual(1);

      await expectNoOverlap(controls(page), drawer);
      await expectNoOverlap(attribution(page), drawer);
      await expectNoOverlap(summary(page), drawer);

      if (width === 1024) {
        await expect(page.getByRole("region", { name: "Vehicles" })).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Close the vehicle drawer to show the list." }),
        ).toHaveAttribute("aria-disabled", "true");
      } else {
        await expect(page.getByRole("region", { name: "Vehicles" })).toBeVisible();
        await expectNoOverlap(page.getByRole("region", { name: "Vehicles" }), drawer);
      }

      await captureForReview(page, `03-drawer-layout-${width}`);
      await expectNoAxeViolations(page);
    }
  });

  test("mobile controls and attribution sit above the sheet", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only layout");
    await gotoMap(page);
    await captureForReview(page, "02b-sheet-peek");

    const peekSheet = await sheet(page).boundingBox();
    const peekControls = await controls(page).boundingBox();
    const peekAttribution = await attribution(page).boundingBox();
    if (!peekSheet || !peekControls || !peekAttribution) throw new Error("missing boxes");
    expect(peekControls.y + peekControls.height).toBeLessThanOrEqual(peekSheet.y + 1);
    expect(peekAttribution.y + peekAttribution.height).toBeLessThanOrEqual(peekSheet.y + 1);
    await expectNoOverlap(controls(page), summary(page));

    const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
    await handle.click();
    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await page.waitForTimeout(300);
    const halfSheet = await sheet(page).boundingBox();
    const halfControls = await controls(page).boundingBox();
    if (!halfSheet || !halfControls) throw new Error("missing boxes");
    expect(halfControls.y + halfControls.height).toBeLessThanOrEqual(halfSheet.y + 1);
    await expectNoOverlap(controls(page), sheet(page));
    await expectNoOverlap(attribution(page), sheet(page));
    await captureForReview(page, "02b-map-controls-mobile");
  });

  test("the full sheet obscures the controls and keeps a map strip", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only layout");
    await gotoMap(page);
    const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
    await handle.focus();
    await page.keyboard.press("End");

    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await page.waitForTimeout(300);
    const full = await sheet(page).boundingBox();
    if (!full) throw new Error("sheet has no box");
    expect(full.y).toBeGreaterThanOrEqual(128);
    expect(full.y).toBeLessThanOrEqual(132);
    expect(await summary(page).count()).toBe(0);

    await expect(controls(page)).toHaveCSS("opacity", "0");
    await expect(controls(page)).toHaveAttribute("inert", /.*/);
    await expect(attribution(page)).toBeVisible();
    const credit = await attribution(page).boundingBox();
    if (!credit) throw new Error("attribution has no box");
    expect(credit.y + credit.height).toBeLessThanOrEqual(full.y + 1);
    const attributionOnTop = await attribution(page).evaluate((element) => {
      const box = element.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return element === top || element.contains(top);
    });
    expect(attributionOnTop).toBe(true);

    const header = page.getByTestId("sheet-header");
    const before = await header.boundingBox();
    const scroller = sheet(page).locator('ul[aria-label="Vehicles"]').locator("..");
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const after = await header.boundingBox();
    expect(after).toEqual(before);
    const afterScroll = await sheet(page).boundingBox();
    expect(afterScroll?.y).toBe(full.y);

    const strip = page.getByRole("button", { name: "Collapse the vehicle list" });
    await strip.click({ position: { x: 24, y: 40 } });
    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await expect(handle).toBeFocused();
    await expect
      .poll(async () => (await sheet(page).boundingBox())?.y ?? 0)
      .toBeGreaterThan(full.y + 100);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    await captureForReview(page, "02b-sheet-full");
  });

  test("dragging the header moves the sheet and the controls together", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only drag");
    await gotoMap(page);
    const header = page.getByTestId("sheet-header");
    const box = await header.boundingBox();
    if (!box) throw new Error("header has no box");
    const peek = (await sheet(page).boundingBox())?.y ?? 0;

    await page.mouse.move(box.x + box.width / 2, box.y + 4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 4 - 240, { steps: 12 });
    await page.waitForTimeout(100);

    const dragged = await sheet(page).boundingBox();
    const draggedControls = await controls(page).boundingBox();
    if (!dragged || !draggedControls) throw new Error("missing boxes");
    expect(dragged.y).toBeLessThan(peek - 100);
    expect(draggedControls.y + draggedControls.height).toBeLessThanOrEqual(dragged.y + 1);
    await captureForReview(page, "02b-sheet-dragging");

    await page.mouse.up();
    const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await captureForReview(page, "02b-sheet-half");
  });

  test("a small drag returns to the snap it started from", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only drag");
    await gotoMap(page);
    const header = page.getByTestId("sheet-header");
    const peek = await sheet(page).boundingBox();
    const peekHeader = await header.boundingBox();
    if (!peek || !peekHeader) throw new Error("missing boxes");

    await page.mouse.move(peekHeader.x + peekHeader.width / 2, peekHeader.y + 4);
    await page.mouse.down();
    await page.mouse.move(peekHeader.x + peekHeader.width / 2, peekHeader.y - 16, {
      steps: 4,
    });
    await page.mouse.up();
    await expect
      .poll(async () => (await sheet(page).boundingBox())?.y ?? 0)
      .toBe(peek.y);

    const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
    await handle.focus();
    await page.keyboard.press("End");
    await page.waitForTimeout(300);
    const full = await sheet(page).boundingBox();
    const fullHeader = await header.boundingBox();
    if (!full || !fullHeader) throw new Error("missing boxes");

    await page.mouse.move(fullHeader.x + fullHeader.width / 2, fullHeader.y + 4);
    await page.mouse.down();
    await page.mouse.move(fullHeader.x + fullHeader.width / 2, fullHeader.y + 24, {
      steps: 4,
    });
    await page.mouse.up();
    await expect
      .poll(async () => (await sheet(page).boundingBox())?.y ?? 0)
      .toBe(full.y);
  });

  test("the sheet header stays inside 360x640 at every snap", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only containment");
    await page.setViewportSize({ width: 360, height: 640 });
    await gotoMap(page);
    const header = page.getByTestId("sheet-header");
    const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });

    for (const key of ["Home", "ArrowUp", "End"] as const) {
      await handle.focus();
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
      const box = await header.boundingBox();
      if (!box) throw new Error("header has no box");
      expect(box.y).toBeGreaterThanOrEqual(40);
      expect(box.y + box.height).toBeLessThanOrEqual(641);
      if (key === "End") {
        const full = await sheet(page).boundingBox();
        expect(full?.y).toBeGreaterThanOrEqual(128);
        expect(full?.y).toBeLessThanOrEqual(132);
      }
      await captureForReview(page, `02b-sheet-360-${key.toLowerCase()}`);
    }
    await expectNoHorizontalScroll(page);
  });

  test("MapTiler styles persist, fall back offline and restore online", async ({ page }) => {
    await gotoMap(page);
    await page.getByRole("button", { name: "Map style" }).click();
    await expect(
      page.getByRole("menuitemradio", { name: "Map" }).getByTestId("menu-item-indicator"),
    ).toBeVisible();
    await captureForReview(page, "02b-style-menu");
    // The popup is portaled outside the landmarks by Radix; the "region" rule
    // targets page content, not transient menus. Everything else is scanned.
    await expectNoAxeViolations(page, ["region"]);
    await page.getByRole("menuitemradio", { name: "Satellite" }).click();
    await expect
      .poll(async () => (await debugMap(page))?.styleState)
      .toBe("ready");
    await expect.poll(async () => (await debugMap(page))?.activeStyle).toBe("satellite");
    await expect(logo(page)).toBeVisible();
    await expect(attribution(page)).toHaveText("© MapTiler © OpenStreetMap contributors");
    await expect(page.getByRole("link", { name: /OpenStreetMap · OpenFreeMap/ })).toHaveCount(0);
    await expectNoAxeViolations(page);

    await page.reload();
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), { timeout: 15_000 })
      .toBe(true);
    await expect.poll(async () => (await debugMap(page))?.activeStyle).toBe("satellite");

    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
      window.dispatchEvent(new Event("offline"));
    });
    await expect(page.getByText("Showing the standard map.").first()).toBeVisible();
    await expect.poll(async () => (await debugMap(page))?.baseStyle).toBe("standard");
    await expect(page.getByRole("link", { name: /OpenStreetMap · OpenFreeMap/ })).toBeVisible();
    await expect(logo(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Map style" }).click();
    for (const name of ["Streets", "Satellite"]) {
      const item = page.getByRole("menuitemradio", { name: new RegExp(name) });
      await expect(item).toHaveAttribute("data-disabled", "");
      await expect(page.getByRole("menu").getByText("Needs a connection").first()).toBeVisible();
    }
    await captureForReview(page, "02b-maptiler-offline");
    await page.keyboard.press("Escape");

    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
      window.dispatchEvent(new Event("online"));
    });
    await expect.poll(async () => (await debugMap(page))?.baseStyle).toBe("satellite");
  });

  test("logo, credit, controls and sheet never collide for any style", { tag: "@theme" }, async ({ page }) => {
    for (const label of ["Map", "Streets", "Satellite"] as const) {
      await gotoMap(page);
      await page.getByRole("button", { name: "Map style" }).click();
      await page.getByRole("menuitemradio", { name: label }).click();
      await expect.poll(async () => (await debugMap(page))?.styleState).toBe("ready");
      await page.keyboard.press("Escape");

      await expectNoOverlap(controls(page), attribution(page));
      await expectNoOverlap(controls(page), summary(page));
      await expectNoOverlap(attribution(page), summary(page));
      if (label === "Map") {
        await expect(logo(page)).toHaveCount(0);
      } else {
        await expect(logo(page)).toBeVisible();
        await expectNoOverlap(logo(page), controls(page));
        await expectNoOverlap(logo(page), attribution(page));
        await expectNoOverlap(logo(page), summary(page));
        if (isMobile(page)) {
          await expectNoOverlap(logo(page), sheet(page));
          const sheetBox = await sheet(page).boundingBox();
          const logoBox = await logo(page).boundingBox();
          if (!sheetBox || !logoBox) throw new Error("missing boxes");
          expect(logoBox.y + logoBox.height).toBeLessThanOrEqual(sheetBox.y + 1);
        }
      }
      if (isMobile(page)) {
        await expectNoOverlap(attribution(page), sheet(page));
        await expectNoOverlap(controls(page), sheet(page));
      }
      if (isMobile(page) && label !== "Map") {
        const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
        await handle.focus();
        await page.keyboard.press("End");
        await page.waitForTimeout(300);
        await expect(controls(page)).toHaveCSS("opacity", "0");
        const full = await sheet(page).boundingBox();
        const logoBox = await logo(page).boundingBox();
        const creditBox = await attribution(page).boundingBox();
        if (!full || !logoBox || !creditBox) throw new Error("missing boxes");
        expect(logoBox.y + logoBox.height).toBeLessThanOrEqual(full.y + 1);
        expect(creditBox.y + creditBox.height).toBeLessThanOrEqual(full.y + 1);
        await expect(logo(page)).toBeVisible();
        await expectNoOverlap(logo(page), sheet(page));
      }
      await expectNoAxeViolations(page);
      await expectNoHorizontalScroll(page);
      await captureForReview(page, `maptiler-${label.toLowerCase()}`);
    }
  });

  test("appearance changes theme and accent without closing the menu", { tag: "@theme" }, async ({ page, theme }) => {
    await gotoMap(page);
    const stack = controls(page).locator("div").first();
    const userMenu = page.getByRole("button", { name: "Account menu for Demo Dispatcher" });

    await userMenu.click();
    const appearance = page.getByRole("group", { name: "Appearance" });
    await expect(appearance).toBeVisible();
    const initialMode = theme === "dark" ? "Dark" : "Light";
    await expect(
      appearance
        .getByRole("menuitemradio", { name: initialMode })
        .getByTestId("menu-item-indicator"),
    ).toBeVisible();
    await appearance.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(
      appearance
        .getByRole("menuitemradio", { name: "Light" })
        .getByTestId("menu-item-indicator"),
    ).toBeVisible();
    await captureForReview(page, "02b-appearance-menu");
    const light = await stack.evaluate((element) => getComputedStyle(element).backgroundColor);

    await appearance.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const dark = await stack.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(dark).not.toBe(light);
    await expect(page.getByRole("menu")).toBeVisible();

    for (const accent of ["Violet", "Fuchsia", "Graphite", "Blue"] as const) {
      await appearance.getByRole("menuitemradio", { name: `${accent} accent` }).click();
      await expect(page.locator("html")).toHaveAttribute("data-accent", accent.toLowerCase());
    }
    await captureForReview(page, "02b-appearance-menu");
    await page.keyboard.press("Escape");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-accent", "blue");
    const prePaint = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script"));
      const bootstrap = scripts.find(
        (script) => !script.src && script.textContent?.includes("fleet.accent"),
      );
      const app = scripts.find((script) => script.src.includes("/src/main.tsx"));
      return {
        bootstrap: Boolean(bootstrap),
        app: Boolean(app),
        before:
          Boolean(bootstrap && app) &&
          Boolean(
            bootstrap?.compareDocumentPosition(app as Node) &&
              bootstrap.compareDocumentPosition(app as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
          ),
      };
    });
    expect(prePaint).toEqual({ bootstrap: true, app: true, before: true });
  });

  test("the top bar keeps only the logo, connection and user menu", async ({ page }) => {
    await gotoMap(page);
    const header = page.locator("header").first();

    await expect(header.getByRole("group", { name: "Colour theme" })).toHaveCount(0);
    await expect(header.getByRole("button", { name: /theme/i })).toHaveCount(0);
    await expect(
      header.getByRole("button", { name: "Account menu for Demo Dispatcher" }),
    ).toBeVisible();
    if (!isMobile(page)) {
      await expect(header.getByRole("searchbox", { name: "Search vehicles" })).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    if (isMobile(page)) await expectTouchTargets(page);
    await captureForReview(page, "02b-top-bar");
  });
});

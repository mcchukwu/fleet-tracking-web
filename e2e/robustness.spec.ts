import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Two structural guarantees: the closure of a route releases what it opened,
 * and a route chunk is fetched only when its screen is opened.
 */

async function seedRole(page: Page, role: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockRole", value);
  }, role);
}

async function gotoMap(page: Page): Promise<void> {
  await page.goto("/map?map=fake");
  await expect(page.getByTestId("map-root")).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded)).toBe(true);
  await expect
    .poll(() => page.evaluate(() => typeof window.__FLEET_DEBUG__?.leaks?.listeners))
    .toBe("number");
}

test.describe("robustness", () => {
  test("fifty route changes return the listener, timer and socket counts to baseline", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    test.skip(
      (page.viewportSize()?.width ?? 1440) < 1024,
      "the leak sweep uses the desktop navigation rail",
    );
    await seedRole(page, "admin");
    await gotoMap(page);
    const nav = page.getByRole("navigation", { name: "Main" });

    // One warm-up cycle so lazy chunks and the socket settle before the baseline.
    for (const name of ["Alerts", "Trips", "Drivers", "Geofences", "Map"]) {
      await nav.getByRole("link", { name }).click();
      await expect(page.locator("[data-page-frame]").first()).toBeVisible({ timeout: 20_000 });
    }
    await page.waitForTimeout(1_000);
    const before = await page.evaluate(() => window.__FLEET_DEBUG__?.leaks);
    expect(before).toBeDefined();

    for (let round = 0; round < 10; round += 1) {
      for (const name of ["Alerts", "Trips", "Drivers", "Geofences", "Map"]) {
        await nav.getByRole("link", { name }).click();
        await expect(page.locator("[data-page-frame]").first()).toBeVisible({ timeout: 20_000 });
      }
    }
    await page.waitForTimeout(1_000);
    const after = await page.evaluate(() => window.__FLEET_DEBUG__?.leaks);
    expect(after).toBeDefined();
    if (!before || !after) return;

    // Window/document listeners must not accumulate per screen. Timers include
    // TanStack Query's 5-minute gc timers, one per unmounted query, so a bounded
    // growth is expected; a linear listener or socket leak is not.
    expect(after.listeners - before.listeners, "listener growth").toBeLessThanOrEqual(20);
    expect(after.timers - before.timers, "timer growth").toBeLessThanOrEqual(80);
    expect(after.sockets - before.sockets, "socket growth").toBeLessThanOrEqual(1);
  });

  test("the map never downloads the geofence drawing library", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (/terra-draw/.test(request.url())) requests.push(request.url());
    });
    await gotoMap(page);
    await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
    await page.waitForTimeout(1_000);
    expect(requests).toEqual([]);
  });

  test("a chunk failure raises the update banner instead of a blank page", async ({ page }) => {
    await seedRole(page, "dispatcher");
    await gotoMap(page);
    // Vite dispatches this when a dynamic import or module preload fails; the
    // app's one-time reload guard and the update banner own the recovery.
    await page.evaluate(() => window.dispatchEvent(new Event("vite:preloadError")));

    await expect(page.getByTestId("banner-region")).toContainText("A new version is available.", {
      timeout: 20_000,
    });
    // The shell and the current map remain usable behind the banner.
    await expect(page.getByTestId("map-root")).toBeVisible();
  });

  test("only one progress surface owns the first map load", async ({ page }) => {
    await page.addInitScript(() => {
      const probe = window as Window & { __progressMax?: number };
      probe.__progressMax = 0;
      const sample = () => {
        const count = document.querySelectorAll('[role="progressbar"]').length;
        probe.__progressMax = Math.max(probe.__progressMax ?? 0, count);
      };
      const observer = new MutationObserver(sample);
      const start = () => {
        observer.observe(document.documentElement, { childList: true, subtree: true });
        sample();
      };
      if (document.documentElement) start();
      else document.addEventListener("DOMContentLoaded", start, { once: true });
    });
    await gotoMap(page);
    await page.waitForTimeout(1_000);
    const max = await page.evaluate(
      () => (window as Window & { __progressMax?: number }).__progressMax,
    );
    expect(max ?? 0).toBeLessThanOrEqual(1);
  });
});

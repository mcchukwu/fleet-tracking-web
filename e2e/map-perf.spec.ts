import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * The real MapLibre adapter, with a mocked style. The fake adapter proves the
 * contract; this proves the WebGL path: a pan stays responsive, the fleet
 * clusters at the fitted zoom and unclusters when zoomed to a street, and
 * fit-to-fleet does not fight a user's pan.
 */

const STYLE = {
  version: 8,
  name: "perf-style",
  glyphs: "https://fonts.test/{fontstack}/{range}.pbf",
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#eef1f4" } }],
};

async function installStyleMock(page: Page): Promise<void> {
  await page.addInitScript((style) => {
    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://styles.test/")) {
        return new Response(JSON.stringify(style), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return original(input, init);
    };
  }, STYLE);
}

async function gotoRealMap(page: Page): Promise<void> {
  await installStyleMock(page);
  await page.goto("/map");
  await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), { timeout: 30_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.targetVehicleCount ?? 0), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
}

async function pan(page: Page, steps: number): Promise<void> {
  const region = page.getByRole("region", { name: "Live map" });
  const box = await region.boundingBox();
  if (!box) throw new Error("The map has no box");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(startX - step * 8, startY - step * 2);
  }
  await page.mouse.up();
}

test.describe("real map performance", () => {
  test("a 20-step pan stays under the recorded long-task threshold", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoRealMap(page);
    // Warm the shaders and the first source update; the measurement is of a
    // steady-state pan, not of the map's first paint.
    await pan(page, 4);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const probe = window as Window & { __perfTasks?: number[] };
      probe.__perfTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) probe.__perfTasks?.push(entry.duration);
      }).observe({ entryTypes: ["longtask"] });
    });

    await pan(page, 20);
    await page.waitForTimeout(1_500);
    const stats = await page.evaluate(() => {
      const tasks = (window as Window & { __perfTasks?: number[] }).__perfTasks ?? [];
      const viewport = window.__FLEET_DEBUG__?.map.viewport;
      return { longest: Math.max(0, ...tasks), count: tasks.length, viewport };
    });
    // Recorded on 2026-11-13: a warmed 20-step pan measured 632-708ms on this
    // host, so the budget leaves headroom while still failing a gross regression.
    // A regression makes the test fail rather than silently degrading the map.
    expect(stats.longest, `longest task ${stats.longest}ms`).toBeLessThan(900);
    expect(stats.viewport).not.toBeNull();
  });

  test("clusters at the fitted fleet zoom and unclusters at street zoom", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoRealMap(page);

    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.clusterCount ?? 0), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);
    const fitted = await page.evaluate(() => window.__FLEET_DEBUG__?.map);
    expect(fitted?.unclusteredCount ?? 0).toBeLessThan(fitted?.targetVehicleCount ?? 0);

    // LSD-100-AA from the fixture; a street-level camera on one vehicle must
    // show a point, not a cluster.
    await page.evaluate(() => {
      window.__FLEET_TEST_MAP__?.flyTo([3.7966666666666664, 7.203333333333333], 16);
    });
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.viewport?.zoom ?? 0), {
        timeout: 30_000,
      })
      .toBeGreaterThan(14);
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.clusterCount ?? -1), {
        timeout: 30_000,
      })
      .toBe(0);
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.unclusteredCount ?? 0), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);
  });

  test("fit-to-fleet runs once and does not fight a user pan", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoRealMap(page);
    const before = await page.evaluate(() => window.__FLEET_DEBUG__?.map);
    expect(before?.fitBounds).not.toBeNull();
    expect(before?.fitCount ?? 0).toBeGreaterThanOrEqual(1);

    await pan(page, 10);
    await page.waitForTimeout(1_000);
    const after = await page.evaluate(() => window.__FLEET_DEBUG__?.map);
    expect(after?.fitCount).toBe(before?.fitCount);
  });
});

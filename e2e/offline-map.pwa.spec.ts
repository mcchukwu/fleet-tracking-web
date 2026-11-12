import { expect, test } from "./pwa/fixtures";

test.describe("offline map pack", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium covers the real WebGL map.");

  test("serves the PMTiles pack from the service worker after an offline reload", async ({
    page,
    context,
    pwa,
  }) => {
    await page.goto("/map");
    await expect(page.getByTestId("map-root")).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.pwa.mapCachedAt ?? null), {
        timeout: 60_000,
      })
      .not.toBeNull();

    const packResponses: Array<{ fromServiceWorker: boolean; status: number }> = [];
    page.on("response", (response) => {
      if (response.url().includes("/map/test.pmtiles")) {
        packResponses.push({
          fromServiceWorker: response.fromServiceWorker(),
          status: response.status(),
        });
      }
    });
    const failedAssets: string[] = [];
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).pathname.startsWith("/map/")) {
        failedAssets.push(request.url());
      }
    });

    pwa.setOffline(true);
    await context.setOffline(true);
    await page.reload();

    await expect(page.getByTestId("map-root")).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), {
        timeout: 60_000,
      })
      .toBe(true);
    await expect(page.getByTestId("map-attribution")).toContainText("Protomaps");
    expect(failedAssets).toEqual([]);
    expect(packResponses.some((response) => response.fromServiceWorker)).toBe(true);
  });
});

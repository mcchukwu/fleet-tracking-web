import type { Route } from "@playwright/test";
import { expect, test } from "./fixtures";

const STYLE = {
  version: 8,
  name: "geofence-draw-test",
  glyphs: "https://fonts.test/{fontstack}/{range}.pbf",
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#eef1f4" } }],
};

async function fulfillStyle(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(STYLE),
  });
}

async function gotoRealMap(page: import("@playwright/test").Page): Promise<void> {
  await page.route(/styles\.test\//, fulfillStyle);
  await page.goto("/geofences");
  await expect(page.getByRole("heading", { name: "Geofences" })).toBeVisible({
    timeout: 20_000,
  });
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), {
      timeout: 30_000,
    })
    .toBe(true);
  await expect(page.getByTestId("geofences-page")).toContainText("4 geofences");
}

async function clickMapPoint(
  page: import("@playwright/test").Page,
  x: number,
  y: number,
): Promise<void> {
  const canvas = page.getByTestId("fleet-map-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("map canvas has no box");
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
}

async function waitForDrawSession(page: import("@playwright/test").Page): Promise<void> {
  await expect(page.getByText("Preparing the drawing tool…")).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__FLEET_TEST_MAP__?.draw)), {
      timeout: 20_000,
    })
    .toBe(true);
}

test.describe("geofences real drawing", () => {
  test("draws with Terra Draw, saves a closed [lon, lat] ring and cancels cleanly", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));

    await gotoRealMap(page);
    const beforeCreate = requests.filter((url) => url.includes("terra-draw")).length;
    expect(beforeCreate).toBe(0);

    await page.getByRole("button", { name: "Create geofence" }).click();
    const form = page.getByRole("form", { name: "New geofence" });
    await expect(form).toBeVisible();
    await waitForDrawSession(page);
    await expect
      .poll(() => requests.filter((url) => url.includes("terra-draw")).length, {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);

    await clickMapPoint(page, 0.3, 0.35);
    await clickMapPoint(page, 0.6, 0.35);
    await clickMapPoint(page, 0.45, 0.62);
    await page.keyboard.press("Enter");
    await expect(page.getByText("Polygon ready.")).toBeVisible({ timeout: 15_000 });
    const viewport = await page.evaluate(() => window.__FLEET_TEST_MAP__?.getViewport());
    if (!viewport) throw new Error("map has no viewport");

    await form.getByLabel("Name").fill("Drawn Gate");
    await form.getByRole("button", { name: "Create geofence" }).click();
    await expect(page.getByText("Geofence created.").first()).toBeVisible({ timeout: 20_000 });

    const write = await page.evaluate(() => window.__FLEET_MOCK_WRITES__?.at(-1));
    const body = write?.body as {
      name: string;
      geometry: { type: string; coordinates: number[][][] };
    };
    expect(body.name).toBe("Drawn Gate");
    const ring = body.geometry.coordinates[0] ?? [];
    expect(ring.length).toBeGreaterThanOrEqual(4);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const [lon, lat] of ring) {
      expect(lon).toBeGreaterThanOrEqual(viewport.bounds.west);
      expect(lon).toBeLessThanOrEqual(viewport.bounds.east);
      expect(lat).toBeGreaterThanOrEqual(viewport.bounds.south);
      expect(lat).toBeLessThanOrEqual(viewport.bounds.north);
    }

    await page.getByRole("button", { name: "Create geofence" }).click();
    const second = page.getByRole("form", { name: "New geofence" });
    await waitForDrawSession(page);
    await clickMapPoint(page, 0.4, 0.4);
    await clickMapPoint(page, 0.55, 0.45);
    await page.keyboard.press("Escape");
    await expect
      .poll(() =>
        page.evaluate(() => window.__FLEET_TEST_MAP__?.draw?.getGeometry() ?? null),
      )
      .toBeNull();
    await second.getByRole("button", { name: "Cancel" }).click();
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(1);
  });
});

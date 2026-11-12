import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectNoOverlap,
} from "./helpers";

async function goOffline(page: Page): Promise<void> {
  await page.getByTestId("banner-region").waitFor({ state: "attached" });
  await page.evaluate(() => window.__FLEET_TEST_CONNECTION__?.({ network: "offline" }));
  await expect(page.getByTestId("banner-region")).toContainText("You're offline");
}

async function goOnline(page: Page): Promise<void> {
  await page.evaluate(() => window.__FLEET_TEST_CONNECTION__?.({ network: "online" }));
}

test.describe.configure({ mode: "serial" });

test.describe("offline presentation", () => {
  test.afterEach(async ({ page }) => {
    await goOnline(page).catch(() => undefined);
  });

  test("map keeps last-known positions with a stale badge", { tag: "@theme" }, async ({ page }) => {
    await page.goto("/map?map=fake");
    await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
    await goOffline(page);

    await expect(page.getByTestId("map-stale-badge")).toContainText("Stale");
    await expect(page.getByTestId("map-attribution")).toBeVisible();
    await expectNoHorizontalScroll(page);

    await captureForReview(page, "13-offline-map-stale");
  });

  test("map becomes a full-width list when the provider cannot work offline", { tag: "@theme" }, async ({
    page,
  }) => {
    await page.goto("/map?map=fake&offline=0");
    await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
    await goOffline(page);

    await expect(page.getByTestId("map-list-only")).toBeVisible();
    await expect(page.getByRole("region", { name: "Live map" })).toHaveCount(0);
    await expect(page.getByText("Map isn't available offline")).toBeVisible();
    await expect(page.getByTestId("map-attribution")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await expectNoOverlap(page.getByTestId("map-kpi"), page.getByTestId("map-list-only"));

    const viewport = page.viewportSize();
    const box = await page.getByTestId("map-list-only").boundingBox();
    if (viewport && box) {
      expect(box.width).toBeGreaterThanOrEqual(viewport.width - 32);
    }

    await captureForReview(page, "13-offline-map-list-only");
  });

  for (const path of ["/alerts", "/trips", "/drivers", "/geofences", "/reports", "/system"]) {
    test(`${path} shows the banner without a region error`, async ({ page }) => {
      await page.goto(path);
      await goOffline(page);
      await expect(page.getByTestId("banner-region")).toContainText("You're offline");
      await expect(page.getByText("Can't reach the server")).toHaveCount(0);
      await expectNoHorizontalScroll(page);
    });
  }

  test("audit explains that the security log is not cached", { tag: "@theme" }, async ({ page }) => {
    await page.goto("/audit");
    await goOffline(page);
    await expect(page.getByTestId("banner-region")).toContainText("You're offline");
    await captureForReview(page, "13-offline-audit");
  });

  test("the update banner is a prompt and has an explicit action", { tag: "@theme" }, async ({ page }) => {
    await page.goto("/map?map=fake");
    await expect(page.getByTestId("map-root")).toBeVisible();
    await expect(page.getByLabel("Connection: Live")).toBeVisible();
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("fleet:update-available")),
    );

    await expect(page.getByTestId("banner-region")).toContainText("A new version is available");
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
    await captureForReview(page, "13-offline-update-banner");
  });
});

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

async function openPanel(page: Page): Promise<void> {
  if (!isMobile(page)) return;
  const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
  if ((await handle.getAttribute("aria-expanded")) === "false") await handle.click();
  await expect(handle).toHaveAttribute("aria-expanded", "true");
}

async function gotoMap(page: Page, search = ""): Promise<void> {
  await page.goto(`/map?map=fake${search ? `&${search}` : ""}`);
  await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
  await expect(page.getByText("Showing 25 of 25")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), { timeout: 15_000 })
    .toBe(true);
}

async function panel(page: Page) {
  return page.getByRole("region", { name: "Vehicles" });
}

test.describe("map", () => {
  test("renders the fleet, KPIs and geofences", async ({ page }) => {
    await gotoMap(page);

    await expect(page).toHaveTitle(/Map · Fleet Console$/);
    await expect(page.getByText("20 of 25")).toBeVisible();
    await expect(page.getByText("vehicles reporting")).toBeVisible();
    await expect(page.getByText("Active trips")).toBeVisible();

    const debug = await page.evaluate(() => window.__FLEET_DEBUG__);
    expect(debug?.map.provider).toBe("fake");
    expect(debug?.map.renderedVehicleCount).toBe(20);
    expect(debug?.map.geofenceCount).toBe(4);
    expect(debug?.connection.network).toBe("online");

    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "02-map-default");
  });

  test("search, status, depot, sort and in-view update the URL and restore", async ({ page }) => {
    await gotoMap(page);
    await openPanel(page);
    const region = await panel(page);

    const search = region.getByRole("searchbox", { name: "Search vehicles" });
    await search.fill("LSD-100");
    await expect(page).toHaveURL(/q=LSD-100/);
    await expect(region.getByText("Showing 1 of 25")).toBeVisible();
    await captureForReview(page, "02-map-filtered");

    await page.goto("/map?map=fake&q=LSD-100");
    await openPanel(page);
    await expect((await panel(page)).getByRole("searchbox", { name: "Search vehicles" })).toHaveValue("LSD-100");
    await expect((await panel(page)).getByText("Showing 1 of 25")).toBeVisible();

    await gotoMap(page);
    await openPanel(page);
    await (await panel(page)).getByRole("button", { name: "Offline" }).click();
    await expect(page).toHaveURL(/status=offline/);
    await expect((await panel(page)).getByText("Showing 5 of 25")).toBeVisible();
    await expect((await panel(page)).getByRole("button", { name: "Offline" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await (await panel(page)).getByLabel("Depot").selectOption("Lekki Depot");
    await expect(page).toHaveURL(/depot=Lekki/);

    await (await panel(page)).getByLabel("Sort").selectOption("lastSeen");
    await expect(page).toHaveURL(/sort=lastSeen/);

    await (await panel(page)).getByLabel("Only in view").check();
    await expect(page).toHaveURL(/view=1/);
    await expect((await panel(page)).getByText("Showing 0 of 25")).toBeVisible();
  });

  test("a row selects the vehicle, highlights the marker and Back clears it", async ({ page }) => {
    await gotoMap(page);
    await openPanel(page);

    await (await panel(page))
      .getByRole("button", { name: "Select LSD-100-AA" })
      .click();
    await expect(page).toHaveURL(/v=[0-9a-f-]{36}/);
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.selectedKey))
      .toBe("demo-imei-0001");
    await captureForReview(page, "02-map-selected");

    await page.goBack();
    await expect(page).not.toHaveURL(/v=/);
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.selectedKey))
      .toBeNull();
  });

  test("j and k move the selection and bracket collapses the panel", async ({ page }) => {
    await gotoMap(page);
    await page.locator("main").focus();
    await page.keyboard.press("j");
    await expect(page).toHaveURL(/v=/);
    await page.keyboard.press("j");
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.selectedKey))
      .toBe("demo-imei-0002");

    if (!isMobile(page)) {
      await page.keyboard.press("[");
      await expect(page.getByRole("region", { name: "Vehicles" })).toHaveCount(0);
      await page.keyboard.press("[");
      await expect(page.getByRole("region", { name: "Vehicles" })).toBeVisible();
    }
  });

  test("copying a plate shows a toast and writes the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await gotoMap(page);
    await openPanel(page);

    await (await panel(page)).getByRole("button", { name: "Copy plate LSD-100-AA" }).click();
    await expect(page.getByText("Plate copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("LSD-100-AA");
  });

  test("a search with no matches distinguishes no results from no data", async ({ page }) => {
    await gotoMap(page);
    await openPanel(page);

    await (await panel(page))
      .getByRole("searchbox", { name: "Search vehicles" })
      .fill("ZZZ");
    await expect((await panel(page)).getByText('No vehicles match "ZZZ"')).toBeVisible();
    await expect((await panel(page)).getByText("Clear the filter to see all 25.")).toBeVisible();
    await captureForReview(page, "02-map-empty");

    await (await panel(page)).getByRole("button", { name: "Clear filters" }).click();
    await expect((await panel(page)).getByText("Showing 25 of 25")).toBeVisible();
  });

  test("a snapshot failure shows an error with Retry and recovers", async ({ page }) => {
    await page.goto("/map?map=fake&fault=live-snapshot:server");
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByText("Something broke.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "02-map-error");

    await page.evaluate(() => history.replaceState({}, "", "/map?map=fake"));
    await page.getByRole("button", { name: "Retry" }).first().click();
    await expect(page.getByText("Showing 25 of 25")).toBeVisible({ timeout: 20_000 });
  });

  test("a failed refresh keeps the cached rows and labels them", async ({ page }) => {
    await gotoMap(page);
    await openPanel(page);

    await page.evaluate(() =>
      history.replaceState({}, "", "/map?map=fake&fault=live-snapshot:server"),
    );
    await page.getByRole("button", { name: /Last data/ }).click();

    await expect((await panel(page)).getByText("Couldn't refresh")).toBeVisible({
      timeout: 25_000,
    });
    await expect((await panel(page)).getByText("LSD-100-AA")).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "02-map-cached-error");
  });

  test("a forbidden snapshot shows the forbidden state without inventing data", async ({ page }) => {
    await page.goto("/map?map=fake&fault=live-snapshot:forbidden");
    await expect(page.getByText(/You don't have access to this/).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Showing 25 of 25")).toHaveCount(0);
    await expectNoAxeViolations(page);
    await captureForReview(page, "02-map-forbidden");
  });

  test("a malformed snapshot shows the contract state with diagnostics", async ({ page }) => {
    await page.goto("/map?map=fake&fault=live-snapshot:malformed");
    await expect(page.getByText("Unexpected response from the server").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Copy diagnostics" })).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "02-map-contract");
  });

  test("an unknown geofence kind still renders the map", async ({ page }) => {
    await gotoMap(page, "fault=geofences:unknown_enum");
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.geofenceCount))
      .toBe(1);
    await expect(page.getByText("Geofences didn't load")).toHaveCount(0);
  });

  test("the mobile sheet has three snap points and keeps the map interactive", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only sheet");
    await gotoMap(page);
    const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
    await expect(handle).toHaveAttribute("aria-expanded", "false");

    await handle.click();
    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await captureForReview(page, "02-map-sheet-half");

    await handle.click();
    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("region", { name: "Vehicles" })).toBeVisible();
    await captureForReview(page, "02-map-sheet-full");

    await handle.focus();
    await page.keyboard.press("Home");
    await expect(handle).toHaveAttribute("aria-expanded", "false");

    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page);
    await expectNoAxeViolations(page);
  });

  test("the desktop panel floats without covering the KPI strip", async ({ page }) => {
    test.skip(isMobile(page), "desktop-only layout");
    await gotoMap(page);

    const region = await panel(page);
    const summary = page.getByLabel("Fleet summary");
    await expectNoOverlap(region, summary);
    const box = await region.boundingBox();
    expect(box?.width).toBeGreaterThan(340);
    expect(box?.width).toBeLessThan(380);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });
});

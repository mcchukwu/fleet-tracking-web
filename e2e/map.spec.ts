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

    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.fitCount ?? 0))
      .toBeGreaterThan(0);
    const debug = await page.evaluate(() => window.__FLEET_DEBUG__);
    expect(debug?.map.provider).toBe("fake");
    expect(debug?.map.targetVehicleCount).toBe(20);
    expect(debug?.map.geofenceCount).toBe(4);
    expect(debug?.map.fitBounds).not.toBeNull();
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
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.targetVehicleCount))
      .toBe(0);

    await (await panel(page)).getByLabel("Depot").selectOption("Lekki Depot");
    await expect(page).toHaveURL(/depot=Lekki/);

    await (await panel(page)).getByLabel("Sort").selectOption("lastSeen");
    await expect(page).toHaveURL(/sort=lastSeen/);

    await (await panel(page)).getByLabel("Only in view").check();
    await expect(page).toHaveURL(/view=1/);
    await expect((await panel(page)).getByText("Showing 0 of 25")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
    await openPanel(page);
    const restored = await panel(page);
    await expect(page).toHaveURL(/status=offline/);
    await expect(page).toHaveURL(/depot=Lekki\+Depot/);
    await expect(page).toHaveURL(/sort=lastSeen/);
    await expect(page).toHaveURL(/view=1/);
    await expect(restored.getByRole("searchbox", { name: "Search vehicles" })).toHaveValue("");
    await expect(restored.getByRole("button", { name: "Offline" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(restored.getByLabel("Depot")).toHaveValue("Lekki Depot");
    await expect(restored.getByLabel("Sort")).toHaveValue("lastSeen");
    await expect(restored.getByLabel("Only in view")).toBeChecked();
    await expect(restored.getByText("Showing 0 of 25")).toBeVisible();
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
    await expect(page.getByText("Plate copied").first()).toBeVisible();
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

  test("a snapshot with vehicles but no positions keeps the fleet list", async ({ page }) => {
    await page.goto("/map?map=fake&positions=none");
    await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
    await expect(page.getByText("Showing 25 of 25")).toBeVisible();
    await openPanel(page);

    const region = await panel(page);
    await expect(
      region.getByText("No vehicles are reporting a position. The list still shows the fleet."),
    ).toBeVisible();
    await expect(region.getByRole("list", { name: "Vehicles" })).toBeVisible();
    await expect(region.getByText("LSD-100-AA")).toBeVisible();
    await expect(region.getByText("No position reported").first()).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "02-map-no-positions");
  });

  test("a snapshot failure shows an error with Retry and recovers", async ({ page }) => {
    await page.goto("/map?map=fake&fault=live-snapshot:server");
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByText("Something broke.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    await expect(page.getByTestId("map-error-overlay")).toBeVisible();
    await expect(page.getByLabel("Fleet summary").getByText("0 of 0")).toHaveCount(0);
    await expectNoAxeViolations(page);
    await captureForReview(page, "02-map-error");

    await page.evaluate(() => history.replaceState({}, "", "/map?map=fake"));
    // Clearing the fault lets either the visible Retry or the query's own
    // backoff recover the snapshot.
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
    await expect(
      page.getByTestId("map-error-overlay").getByRole("button", { name: "Copy diagnostics" }),
    ).toBeVisible();
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

  test("offline keeps the cached fleet and marks it stale instead of erroring", async ({ page }) => {
    await gotoMap(page);
    await openPanel(page);

    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
      window.dispatchEvent(new Event("offline"));
    });

    await expect(page.getByText(/You're offline/)).toBeVisible();
    await expect((await panel(page)).getByText(/Stale ·/)).toBeVisible();
    await expect(page.getByText("Something went wrong on our side")).toHaveCount(0);
    await expect((await panel(page)).getByText("Showing 25 of 25")).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "02-map-stale-offline");
  });

  test("a denied clipboard failure explains how to copy manually", async ({ page }) => {
    await gotoMap(page);
    await openPanel(page);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("denied")) },
      });
    });

    await (await panel(page)).getByRole("button", { name: "Copy plate LSD-100-AA" }).click();
    await expect(page.getByText("Couldn't copy", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Select the text and press Ctrl+C.").first()).toBeVisible();
  });

  test("live ticks do not drag the list back to the selection", async ({ page }) => {
    await gotoMap(page);
    await openPanel(page);
    const region = await panel(page);

    await region.getByRole("button", { name: "Select LSD-100-AA" }).click();
    const scroller = region.locator('ul[aria-label="Vehicles"]').locator("..");
    await scroller.evaluate((element) => {
      element.scrollTop = 400;
    });
    const before = await scroller.evaluate((element) => element.scrollTop);
    expect(before).toBeGreaterThan(0);

    await page.waitForTimeout(1_500);
    expect(await scroller.evaluate((element) => element.scrollTop)).toBe(before);
  });

  test("a map adapter failure leaves the vehicle list usable", async ({ page }) => {
    await page.goto("/map?map=fake&adapter=error");
    await expect(page.getByText("The map couldn't load")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    await openPanel(page);
    await expect(page.getByText("Showing 25 of 25")).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "02-map-adapter-error");
  });

  test("a crash in the map overlay is contained by the panel boundary", async ({ page }) => {
    await page.goto("/map?map=fake&crash=map");
    await expect(page.getByText("This part of the page stopped working")).toBeVisible({
      timeout: 15_000,
    });
    await openPanel(page);
    await expect(page.getByText("Showing 25 of 25")).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "02-map-render-crash");
  });

  test("a slow snapshot request reports progress instead of a silent skeleton", async ({
    page,
  }) => {
    await page.goto("/map?map=fake&fault=live-snapshot:slow");
    await openPanel(page);
    await expect(page.getByText("Still working…")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Taking longer than usual")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    await captureForReview(page, "02-map-slow");
  });

  test("slow Cancel removes the pending surfaces and offers Retry", async ({ page }) => {
    await page.goto("/map?map=fake&fault=live-snapshot:slow");
    await openPanel(page);
    await expect(page.getByText("Taking longer than usual")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByText("Taking longer than usual")).toHaveCount(0);
    await expect(page.getByText("Still working…")).toHaveCount(0);
    await expect(page.getByLabel("Loading vehicles")).toHaveCount(0);
    await expect(page.getByText("Loading cancelled")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("turning geofences off removes them from the map", async ({ page }) => {
    test.skip(isMobile(page), "desktop-only map controls");
    await gotoMap(page);

    await page.getByRole("button", { name: "Hide geofences" }).click();
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.geofenceCount))
      .toBe(0);
    await captureForReview(page, "02-map-geofences-off");
  });

  test("the mobile sheet has three snap points and keeps the map interactive", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only sheet");
    await gotoMap(page);
    const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
    await expect(handle).toHaveAttribute("aria-expanded", "false");

    await handle.click();
    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await captureForReview(page, "02-map-sheet-half");

    await handle.focus();
    await page.keyboard.press("End");
    await expect(page.getByRole("region", { name: "Vehicles" })).toBeVisible();
    await captureForReview(page, "02-map-sheet-full");
    await expectTouchTargets(page);

    await handle.click();
    await expect(handle).toHaveAttribute("aria-expanded", "false");
    await handle.click();
    await expect(handle).toHaveAttribute("aria-expanded", "true");

    await handle.focus();
    await page.keyboard.press("Home");
    await expect(handle).toHaveAttribute("aria-expanded", "false");

    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test("closing the desktop panel returns focus to its toggle", async ({ page }) => {
    test.skip(isMobile(page), "desktop-only panel");
    await gotoMap(page);

    await page.getByRole("button", { name: "Hide the vehicle panel" }).first().click();

    await expect(page.getByRole("button", { name: "Show the vehicle panel" })).toBeFocused();
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

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

async function gotoGeofences(page: Page, search = ""): Promise<void> {
  await page.goto(`/geofences?map=fake${search ? `&${search}` : ""}`);
  await expect(page.getByRole("heading", { name: "Geofences" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("geofences-page")).toContainText("4 geofences");
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), {
      timeout: 15_000,
    })
    .toBe(true);
}

function row(page: Page, name: string) {
  return page
    .getByRole("list", { name: "Geofences" })
    .getByRole("button", { name: new RegExp(name) });
}

// These tests navigate several states and run axe in each; axe can take tens of
// seconds per state when all four projects run in parallel on a loaded host.
test.describe.configure({ timeout: 120_000 });

test.describe("geofences layout", { tag: "@theme" }, () => {
  test("keeps a 360px list and fixed 48px rows on desktop", async ({ page }) => {
    test.skip(isMobile(page), "desktop-only layout");
    await gotoGeofences(page);
    const panel = page.getByRole("region", { name: "Geofence list" });
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs((box?.width ?? 0) - 360)).toBeLessThanOrEqual(1);

    const heights = await page
      .locator("[data-geofence-row]")
      .evaluateAll((elements) =>
        elements.map((element) => Math.round(element.getBoundingClientRect().height)),
      );
    expect(heights.length).toBeGreaterThan(0);
    for (const height of heights) expect(Math.abs(height - 48)).toBeLessThanOrEqual(1);

    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "08-geofences-layout-desktop");

    const map = page.getByRole("region", { name: "Geofence map" });
    await expectNoOverlap(panel, map);

    const zoomIn = await page.getByRole("button", { name: "Zoom in" }).boundingBox();
    expect(zoomIn).not.toBeNull();
    expect(Math.abs((zoomIn?.width ?? 0) - 36)).toBeLessThanOrEqual(1);
  });

  test("keeps the split at a 1024px viewport", async ({ page }) => {
    test.skip(isMobile(page), "desktop-only layout");
    await page.setViewportSize({ width: 1024, height: 768 });
    await gotoGeofences(page);
    const panel = page.getByRole("region", { name: "Geofence list" });
    const map = page.getByRole("region", { name: "Geofence map" });
    const box = await panel.boundingBox();
    expect(Math.abs((box?.width ?? 0) - 360)).toBeLessThanOrEqual(1);
    await expectNoOverlap(panel, map);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "08-geofences-layout-1024");
  });

  test("stacks the map above the list on mobile without overflow", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only layout");
    await gotoGeofences(page);
    const map = page.getByRole("region", { name: "Geofence map" });
    const panel = page.getByRole("region", { name: "Geofence list" });
    const mapBox = await map.boundingBox();
    const panelBox = await panel.boundingBox();
    expect(mapBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect((mapBox?.y ?? 0) + (mapBox?.height ?? 0)).toBeLessThanOrEqual(panelBox?.y ?? 0);

    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page, 44);
    await expectNoAxeViolations(page);
    await captureForReview(page, "08-geofences-layout-mobile");

    const controls = page.getByRole("button", { name: "Fit all geofences" });
    const attribution = page.getByTestId("map-attribution");
    await expectNoOverlap(controls, attribution);
    await expectNoOverlap(controls, panel);
  });

  test("the selected state, editor and dialogs keep clear of the map chrome", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoGeofences(page);
    await row(page, "Border").click();
    await expectNoAxeViolations(page);
    await captureForReview(page, "08-geofences-review-selected");

    const panel = page.getByRole("region", { name: "Geofence list" });
    const controls = page.getByRole("button", { name: "Fit all geofences" });
    const attribution = page.getByTestId("map-attribution");
    await expectNoOverlap(panel, controls);
    await expectNoOverlap(panel, attribution);

    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("form", { name: "Edit geofence" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "08-geofences-review-editor");

    await page.getByRole("button", { name: "Close editor" }).click();
    await expect(page.getByRole("list", { name: "Geofences" })).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("dialog", { name: 'Delete geofence "Border"?' });
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "08-geofences-review-delete");

    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(row(page, "Border")).toHaveCount(0);
    await page.getByRole("button", { name: "Create geofence" }).click();
    await expect(page.getByRole("form", { name: "New geofence" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("empty, forbidden, error and 409 states are clean", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/geofences?map=fake&empty=geofences");
    await expect(page.getByText("No geofences yet")).toBeVisible({ timeout: 15_000 });
    await expectNoAxeViolations(page);
    await captureForReview(page, "08-geofences-review-empty");

    await page.goto("/geofences?map=fake&fault=geofences%3Aforbidden");
    await expect(page.getByText("You don't have access to this.")).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "08-geofences-review-forbidden");

    await page.goto("/geofences?map=fake&fault=geofences%3Aserver");
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoAxeViolations(page);
    await captureForReview(page, "08-geofences-review-error");

    await page.goto("/geofences?map=fake");
    await expect(page.getByText("4 geofences")).toBeVisible({ timeout: 15_000 });
    await row(page, "Refinery Gate").click();
    await page.getByRole("button", { name: "Delete" }).click();
    const blocked = page.getByRole("dialog", { name: 'Delete geofence "Refinery Gate"?' });
    await blocked.getByRole("button", { name: "Delete" }).click();
    await expect(
      blocked.getByText("This geofence has recorded events and can't be deleted."),
    ).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "08-geofences-review-409");
  });

  test("a 360px viewport still holds the stacked layout", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only layout");
    await page.setViewportSize({ width: 360, height: 640 });
    await gotoGeofences(page);
    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page, 44);
    const panel = page.getByRole("region", { name: "Geofence list" });
    const map = page.getByRole("region", { name: "Geofence map" });
    await expectNoOverlap(panel, map);
    await expectNoAxeViolations(page);
    await captureForReview(page, "08-geofences-layout-360");
  });
});

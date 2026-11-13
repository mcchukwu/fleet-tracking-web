import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectStableColumns,
  expectTabularNums,
  expectTouchTargets,
} from "./helpers";

function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 1024;
}

/** The persisted query cache would legitimately replace a cold error with stale rows. */
async function clearPersistedCache(page: Page): Promise<void> {
  await page.addInitScript(() => {
    indexedDB.deleteDatabase("keyval-store");
  });
}

async function gotoDrivers(page: Page, search = ""): Promise<void> {
  await page.goto(`/drivers${search ? `?${search}` : ""}`);
  await expect(page.getByRole("heading", { name: "Drivers" })).toBeVisible();
  await expect(page.getByTestId("drivers-page")).toBeVisible();
}

async function openDrawer(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /Open driver Adebayo Okafor/ })
    .first()
    .click();
  await expect(page.getByRole("complementary", { name: "Driver details" })).toBeVisible();
}

test.describe("drivers layout", { tag: "@theme" }, () => {
  test("keeps one fixed column geometry and 36px rows", async ({ page }) => {
    await gotoDrivers(page);
    await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
    await page.locator('[data-row="data"]').first().waitFor();

    await expectStableColumns(page.locator("[data-data-table]").first());
    const rows = await page
      .locator('[data-row="data"]')
      .evaluateAll((elements) =>
        elements.map((element) => Math.round(element.getBoundingClientRect().height)),
      );
    for (const height of rows) expect(Math.abs(height - 36)).toBeLessThanOrEqual(1);

    await expectNoHorizontalScroll(page);
    await expectTabularNums(
      page.locator('[data-row="data"] td[data-column-id="vehicles"]').first(),
    );
    if (isMobile(page)) await expectTouchTargets(page, 44);
    await expectNoAxeViolations(page);
    await captureForReview(page, "07-drivers-layout-list");
  });

  test("the table is the only horizontal scroller on a narrow viewport", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only layout");
    await gotoDrivers(page);
    const table = page.locator("[data-data-table-scroll]").first();
    const overflow = await table.evaluate(
      (element) => element.scrollWidth > element.clientWidth + 1,
    );
    expect(overflow).toBe(true);
    await expectNoHorizontalScroll(page);
    const body = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 1);
  });

  test("holds the same geometry at 360px", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only layout");
    await page.setViewportSize({ width: 360, height: 640 });
    await gotoDrivers(page);
    await page.locator('[data-row="data"]').first().waitFor();

    await expectStableColumns(page.locator("[data-data-table]").first());
    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page, 44);
    await expectNoAxeViolations(page);
    await captureForReview(page, "07-drivers-layout-360");
  });

  test("the drawer, create, edit and deactivate states are axe clean", async ({ page }) => {
    await gotoDrivers(page);

    await page.getByRole("button", { name: "Create driver" }).click();
    const create = page.getByRole("dialog", { name: "Create driver" });
    await expect(create).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "07-drivers-create-dialog");
    await page.keyboard.press("Escape");
    await expect(create).toHaveCount(0);

    await openDrawer(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "07-drivers-detail-drawer");

    await page
      .getByRole("complementary", { name: "Driver details" })
      .getByRole("button", { name: "Edit driver" })
      .click();
    const edit = page.getByRole("dialog", { name: "Edit driver" });
    await expect(edit).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "07-drivers-edit-dialog");
    await edit.getByLabel("Status").selectOption("inactive");
    await edit.getByRole("button", { name: "Save changes" }).click();
    const deactivate = page.getByRole("dialog", {
      name: "Deactivate Adebayo Okafor?",
    });
    await expect(deactivate).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "07-drivers-deactivate-dialog");
    await page.keyboard.press("Escape");
  });

  test("the empty, no-results, error, forbidden and contract states are axe clean", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoDrivers(page, "empty=drivers");
    await expect(page.getByText("No drivers yet")).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "07-drivers-layout-no-data");

    await gotoDrivers(page);
    await page.getByLabel("Search drivers").fill("NO-SUCH-DRIVER");
    await expect(page.getByText("No drivers match")).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "07-drivers-layout-no-results");
    await expectNoHorizontalScroll(page);

    await clearPersistedCache(page);
    await gotoDrivers(page, "fault=drivers%3Aserver");
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    await captureForReview(page, "07-drivers-layout-error");

    await gotoDrivers(page, "fault=drivers%3Aforbidden");
    await expect(page.getByText("You don't have access to this.")).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "07-drivers-layout-forbidden");

    await gotoDrivers(page, "fault=drivers%3Acontract");
    await expect(page.getByText("Unexpected response from the server").first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoAxeViolations(page);
    await captureForReview(page, "07-drivers-layout-contract");
  });

  test("offline cached rows keep the stale presentation in both themes", async ({
    page,
    context,
  }) => {
    await gotoDrivers(page);
    await expect(page.getByTestId("drivers-page")).toContainText("26 drivers");
    await context.setOffline(true);
    await expect(page.getByText("You're offline", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Stale ·/)).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "07-drivers-layout-offline");
    await context.setOffline(false);
  });
});

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

async function gotoTrips(page: Page, search = ""): Promise<void> {
  await page.goto(`/trips${search ? `?${search}` : ""}`);
  await expect(page.getByRole("heading", { name: "Trips" })).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Vehicle" }),
  ).toBeVisible();
}

test.describe("trips layout", { tag: "@theme" }, () => {
  test("keeps one fixed column geometry and 36px rows", async ({ page }) => {
    await gotoTrips(page);
    await page.locator('[data-row="data"]').first().waitFor();

    await expectStableColumns(page.locator("[data-data-table]").first());
    const rows = await page
      .locator('[data-row="data"]')
      .evaluateAll((elements) =>
        elements.map((element) =>
          Math.round(element.getBoundingClientRect().height),
        ),
      );
    for (const height of rows)
      expect(Math.abs(height - 36)).toBeLessThanOrEqual(1);

    await expectNoHorizontalScroll(page);
    await expectTabularNums(
      page.locator('[data-row="data"] td[data-column-id="distance"]').first(),
    );
    if (isMobile(page)) await expectTouchTargets(page, 44);
    await expectNoAxeViolations(page);
  });

  test("the table scrolls inside its region on a narrow viewport", async ({
    page,
  }) => {
    test.skip(!isMobile(page), "mobile-only layout");
    await gotoTrips(page);
    const table = page.locator("[data-data-table-scroll]").first();
    const overflow = await table.evaluate(
      (element) => element.scrollWidth > element.clientWidth + 1,
    );
    expect(overflow).toBe(true);
    await expectNoHorizontalScroll(page);
  });

  test("create dialog, detail drawer and empty state are axe clean", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoTrips(page);

    await page.getByRole("button", { name: "Create trip" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Create trip" });
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "06-trips-create-dialog");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    const open = page
      .getByRole("button", { name: /Open trip to .* for LSD-100-AA/ })
      .first();
    await open.click();
    const drawer = page.getByRole("complementary", { name: "Trip details" });
    await expect(drawer).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "06-trips-detail-drawer");
    await page.keyboard.press("Escape");

    await page.getByLabel("Search trips").fill("NO-SUCH-TRIP");
    await expect(page.getByText("No trips match")).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "06-trips-empty-state");
  });

  test("the error state is axe clean and never scrolls sideways", async ({
    page,
  }) => {
    await gotoTrips(page, "fault=trips%3Aserver");
    await expect(
      page.getByText("Something went wrong on our side").first(),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    await captureForReview(page, "06-trips-error-state");
  });

  test("the mobile table is the only horizontal scroller", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only layout");
    await gotoTrips(page);
    await expectNoHorizontalScroll(page);
    const body = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 1);
  });
});

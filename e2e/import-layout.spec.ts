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

test.describe.configure({ timeout: 60_000 });

const validCsv = `imei,plate,vehicle_type,make,model,year,colour,depot
layout-import-1,LSD-990-AA,truck,Volvo,FH,2021,White,Lagos
layout-import-2,LSD-991-AA,van,Ford,Transit,2022,Blue,Ibadan`;

function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 1024;
}

async function gotoImport(page: Page): Promise<void> {
  await page.goto("/import");
  await expect(page.getByRole("heading", { name: "Import", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
}

async function uploadCsv(page: Page, csv: string, name = "vehicles.csv"): Promise<void> {
  await page.getByTestId("import-file-input").setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
}

function badRows(count: number): string {
  return Array.from(
    { length: count },
    (_, index) => `layout-bad-${index + 1},LSD-${800 + index}-AA,not-a-year`,
  ).join("\n");
}

test.describe("import layout", () => {
  test("the preview and result hold their columns and stay inside the page", { tag: "@theme" }, async ({
    page,
  }) => {
    await gotoImport(page);
    await expectNoHorizontalScroll(page);
    await captureForReview(page, "09-import-empty");
    await expectNoAxeViolations(page);

    await uploadCsv(page, validCsv);
    const preview = page.getByTestId("import-preview");
    await expect(preview).toBeVisible();
    await expectStableColumns(
      page.getByTestId("import-preview").locator("[data-data-table]"),
      36,
    );
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "09-import-preview");
    if ((page.viewportSize()?.width ?? 1440) < 768) {
      await expectTouchTargets(page, 44, '[data-testid="import-file-input"]');
    }

    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByTestId("import-result")).toBeVisible({ timeout: 15_000 });
    await expectTabularNums(
      page.getByTestId("import-result").locator('span[class*="tabular-nums"]').first(),
    );
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "09-import-result");
  });

  test("the capped error table keeps its rows fixed and scrolls inside itself", { tag: "@theme" }, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoImport(page);
    await uploadCsv(page, `imei,plate,year\n${badRows(105)}`, "broken.csv");
    await expect(page.getByTestId("import-preview")).toBeVisible();
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByTestId("import-error-table")).toBeVisible({
      timeout: 15_000,
    });

    await expectStableColumns(
      page.getByTestId("import-error-table").locator("[data-data-table]"),
      36,
    );
    await expectTabularNums(
      page.getByTestId("import-error-table").locator('td[data-column-id="row"]').first(),
    );
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    if ((page.viewportSize()?.width ?? 1440) < 768) {
      await expectTouchTargets(page, 44, '[data-testid="import-file-input"]');
    }
    await captureForReview(page, "09-import-partial");
  });

  test("holds the preview, result and recent rows at 360px", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only layout");
    await page.setViewportSize({ width: 360, height: 640 });
    await gotoImport(page);
    await expectNoHorizontalScroll(page);

    await uploadCsv(page, validCsv);
    await expect(page.getByTestId("import-preview")).toBeVisible();
    await expectStableColumns(
      page.getByTestId("import-preview").locator("[data-data-table]"),
      36,
    );
    await expectNoHorizontalScroll(page);

    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByTestId("import-result")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("import-recent-list")).toBeVisible();

    const heights = await page
      .locator("[data-recent-import]")
      .evaluateAll((elements) =>
        elements.map((element) => Math.round(element.getBoundingClientRect().height)),
      );
    expect(heights.length).toBeGreaterThan(0);
    for (const height of heights) expect(Math.abs(height - 56)).toBeLessThanOrEqual(1);

    await expectNoHorizontalScroll(page);
    await expectTabularNums(
      page.getByTestId("import-recent").locator(".tabular-nums").first(),
    );
    await expectNoAxeViolations(page);
    await captureForReview(page, "09-import-layout-360");
  });

  test("the failure notice stays readable in both themes", { tag: "@theme" }, async ({
    page,
  }) => {
    await page.goto("/import?fault=import%3Aserver");
    await expect(page.getByRole("heading", { name: "Import", level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    await uploadCsv(page, validCsv);
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByTestId("import-failure")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "09-import-error");
  });
});

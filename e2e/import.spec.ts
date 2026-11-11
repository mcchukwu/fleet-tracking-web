import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./helpers";

async function gotoImport(page: Page): Promise<void> {
  await page.goto("/import");
  await expect(page.getByRole("heading", { name: "Import", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
}

async function uploadCsv(
  page: Page,
  csv: string,
  name = "vehicles.csv",
): Promise<void> {
  await page.getByTestId("import-file-input").setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
}

function rows(count: number, options: { year?: string } = {}): string {
  return Array.from(
    { length: count },
    (_, index) =>
      `e2e-import-${index + 1},LSD-${String(900 + index).padStart(3, "0")}-AA,truck,Volvo,FH,${options.year ?? "2021"},White,Lagos`,
  ).join("\n");
}

const validCsv = `imei,plate,vehicle_type,make,model,year,colour,depot
e2e-import-1,LSD-950-AA,truck,Volvo,FH,2021,White,Lagos
e2e-import-2,LSD-951-AA,van,Ford,Transit,2022,Blue,Ibadan`;

test.describe("import", () => {
  test("previews and imports a valid file, then hands off to the map search", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoImport(page);
    await expect(page.getByTestId("import-header-row")).toBeVisible();
    await expect(
      page.getByText("No imports on this device yet."),
    ).toBeVisible();
    await captureForReview(page, "09-import-empty");
    await expectNoAxeViolations(page);

    await uploadCsv(page, validCsv);
    await expect(page.getByTestId("import-preview")).toBeVisible();
    await expect(page.getByText("First 5 rows")).toBeVisible();
    await expect(
      page.getByTestId("import-preview").locator('tbody tr[data-row="data"]'),
    ).toHaveCount(2);
    await expect(page.getByText("This file has no imei column.")).toHaveCount(0);
    await captureForReview(page, "09-import-preview");

    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByTestId("import-result")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("import-result-sentence")).toHaveText(
      "2 vehicles imported.",
    );
    await expect(page.getByTestId("import-result")).toContainText("Total rows");
    await expect(page.getByTestId("import-error-table")).toHaveCount(0);
    await expect(page.getByTestId("import-result-heading")).toBeFocused();
    await expect(page.getByTestId("import-recent-list")).toBeVisible();
    await expect(page.getByTestId("import-recent")).toContainText("This device");
    await captureForReview(page, "09-import-result");
    await expectNoAxeViolations(page);

    await page.getByRole("button", { name: "Search a plate" }).click();
    await expect(page).toHaveURL(/\/map/);
    const search = page
      .locator("#vehicle-search:visible, #vehicle-search-mobile:visible")
      .first();
    await expect(search).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.activeElement?.id === "vehicle-search" ||
            document.activeElement?.id === "vehicle-search-mobile",
        ),
      )
      .toBe(true);

    await search.fill("LSD-950-AA");
    await search.press("Enter");
    if ((page.viewportSize()?.width ?? 1440) < 768) {
      await page
        .getByRole("button", { name: /Showing \d+ of \d+/ })
        .click();
    }
    await expect(page.getByText("LSD-950-AA").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("blocks a file with no imei column and recovers with another file", async ({
    page,
  }) => {
    await gotoImport(page);
    await uploadCsv(page, "plate,make\nLSD-960-AA,Volvo", "no-imei.csv");

    const error = page.getByTestId("import-preview-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText("This file has no imei column.");
    await expect(error).toBeFocused();
    await expect(page.getByRole("button", { name: "Upload file" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await captureForReview(page, "09-import-missing-imei");

    await page.getByRole("button", { name: "Choose another file" }).click();
    await uploadCsv(page, validCsv, "vehicles.csv");
    await expect(page.getByTestId("import-preview")).toBeVisible();
    await expect(page.getByTestId("import-preview-error")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Upload file" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  test("reports a partial import with the capped row-error table and a CSV download", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoImport(page);
    await uploadCsv(
      page,
      `imei,plate,year\n${rows(105, { year: "not-a-year" })}`,
      "broken-105.csv",
    );
    await expect(page.getByTestId("import-preview")).toBeVisible();
    await page.getByRole("button", { name: "Upload file" }).click();

    await expect(page.getByTestId("import-result")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("import-result-sentence")).toHaveText(
      "No vehicles imported. 105 rows failed.",
    );
    await expect(page.getByTestId("import-error-notice")).toHaveText(
      "Showing the first 100 of 105 row errors.",
    );
    await expect(
      page.getByTestId("import-error-table").getByRole("row"),
    ).toHaveCount(101);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await captureForReview(page, "09-import-partial");
    await expectNoAxeViolations(page);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download errors as CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("import-errors-broken-105.csv");
  });

  test("parses only five preview rows from a 5,000-row file and accepts a replacement", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoImport(page);
    await uploadCsv(page, `imei,plate,year\n${rows(5_000)}`, "large.csv");
    await expect(page.getByTestId("import-preview")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByTestId("import-preview").locator('tbody tr[data-row="data"]'),
    ).toHaveCount(5);
    await expectNoHorizontalScroll(page);

    await uploadCsv(
      page,
      "imei,plate\nreplacement-1,LSD-970-AA",
      "replacement.csv",
    );
    await expect(page.getByTestId("import-selected-file")).toContainText(
      "replacement.csv",
    );
    await expect(
      page.getByTestId("import-preview").locator('tbody tr[data-row="data"]'),
    ).toHaveCount(1);
    await expect(page.getByText("LSD-970-AA")).toBeVisible();
  });

  test("re-uploading the same file adds two device-local results", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoImport(page);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await uploadCsv(page, validCsv);
      await page.getByRole("button", { name: "Upload file" }).click();
      await expect(page.getByTestId("import-result-sentence")).toHaveText(
        "2 vehicles imported.",
      );
      await expect(page.getByTestId("import-recent-list")).toBeVisible();
    }

    await expect(page.locator("[data-recent-import]")).toHaveCount(2);
    await expect(page.getByTestId("import-recent")).toContainText(
      "The server has no import history.",
    );
  });

  test("rejects a non-CSV file before any upload", async ({ page }) => {
    await gotoImport(page);
    await uploadCsv(page, "imei\n1", "vehicles.txt");
    const error = page.getByTestId("import-preview-error");
    await expect(error).toContainText("Choose a .csv file.");
    await expect(page.getByRole("button", { name: "Upload file" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  test("keeps the local preview usable offline and disables the upload", async ({
    page,
    context,
  }) => {
    await gotoImport(page);
    await context.setOffline(true);
    await expect(page.getByText(/You're offline/).first()).toBeVisible({
      timeout: 15_000,
    });
    await uploadCsv(page, validCsv);
    await expect(page.getByTestId("import-preview")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload file" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(page.getByTestId("import-preview-error")).toHaveCount(0);
    await context.setOffline(false);
  });
});

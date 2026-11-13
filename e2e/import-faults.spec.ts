import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations, expectNoHorizontalScroll } from "./helpers";

test.describe.configure({ timeout: 60_000 });

const csv = `imei,plate,year
fault-import-1,LSD-980-AA,2021`;

async function gotoFault(page: Page, fault: string): Promise<void> {
  await page.goto(`/import?fault=${encodeURIComponent(fault)}`);
  await expect(page.getByRole("heading", { name: "Import", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
}

async function chooseFile(page: Page): Promise<void> {
  await page.getByTestId("import-file-input").setInputFiles({
    name: "vehicles.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.getByTestId("import-preview")).toBeVisible();
}

async function clearFault(page: Page): Promise<void> {
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("fault");
    history.replaceState({}, "", `${url.pathname}${url.search}`);
  });
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

function unexpectedConsole(errors: string[]): string[] {
  return errors.filter(
    (text) => !text.includes("above error occurred") && !text.includes("Failed to load resource"),
  );
}

test.describe("import faults", { tag: "@fault" }, () => {
  test("a server failure is an inline notice with Retry, not a toast or raw text", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await gotoFault(page, "import:server");
    await chooseFile(page);
    await page.getByRole("button", { name: "Upload file" }).click();

    const notice = page.getByTestId("import-failure");
    await expect(notice).toBeVisible();
    await expect(notice).toBeFocused();
    await expect(notice).toContainText("Something went wrong on our side");
    await expect(notice).not.toContainText("Something broke.");
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await captureForReview(page, "09-import-fault-server");
    await expectNoAxeViolations(page);

    await clearFault(page);
    await notice.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByTestId("import-result-sentence")).toHaveText("1 vehicle imported.", {
      timeout: 15_000,
    });
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a server validation message lands in the inline notice", async ({ page }) => {
    const errors = collectErrors(page);
    await gotoFault(page, "import:validation");
    await chooseFile(page);
    await page.getByRole("button", { name: "Upload file" }).click();

    const notice = page.getByTestId("import-failure");
    await expect(notice).toContainText("Couldn't import this file");
    await expect(notice).toContainText("Check the fields.");
    await expect(notice).toBeFocused();
    await expect(page.getByTestId("import-selected-file")).toBeVisible();
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("an unanswered upload says it is safe to upload again", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await gotoFault(page, "import:timeout");
    await chooseFile(page);
    await page.clock.install();
    await page.getByRole("button", { name: "Upload file" }).click();
    await page.clock.runFor(121_000);

    const notice = page.getByTestId("import-failure");
    await expect(notice).toContainText("We couldn't confirm the import");
    await expect(notice).toContainText("It's safe to upload again.");
    await expect(notice).toBeFocused();
    await expectNoAxeViolations(page);
    expect(unexpectedConsole(errors)).toEqual([]);

    await clearFault(page);
    await notice.getByRole("button", { name: "Upload again" }).click();
    await expect(page.getByTestId("import-result-sentence")).toHaveText("1 vehicle imported.", {
      timeout: 15_000,
    });
  });

  test("a response lost after the upload saved is safe to retry without duplicates", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await gotoFault(page, "import-post:lost_after_save");
    await chooseFile(page);
    await page.clock.install();
    await page.getByRole("button", { name: "Upload file" }).click();
    await page.clock.runFor(121_000);

    const notice = page.getByTestId("import-failure");
    await expect(notice).toContainText("We couldn't confirm the import", { timeout: 20_000 });
    await expect(notice).toContainText("It's safe to upload again.");
    await clearFault(page);
    await notice.getByRole("button", { name: "Upload again" }).click();
    await expect(page.getByTestId("import-result-sentence")).toHaveText("1 vehicle imported.", {
      timeout: 20_000,
    });
    const rows = await page.evaluate(async () => {
      const response = await fetch("/api/v1/vehicles?q=fault-import-1");
      const payload = (await response.json()) as { data: unknown[] };
      return payload.data.length;
    });
    expect(rows).toBe(1);
  });

  test("a forbidden upload offers a way back", async ({ page }) => {
    const errors = collectErrors(page);
    await gotoFault(page, "import:forbidden");
    await chooseFile(page);
    await page.getByRole("button", { name: "Upload file" }).click();

    const notice = page.getByTestId("import-failure");
    await expect(notice).toContainText("Your role can't import vehicles.");
    await expect(notice).toBeFocused();
    expect(unexpectedConsole(errors)).toEqual([]);
    await notice.getByRole("button", { name: "Back to the map" }).click();
    await expect(page).toHaveURL(/\/map/);
  });

  test("a session expiry shows the blocking dialog and keeps the file", async ({ page }) => {
    const errors = collectErrors(page);
    await gotoFault(page, "import:unauthenticated");
    await chooseFile(page);
    await page.getByRole("button", { name: "Upload file" }).click();

    const dialog = page.getByRole("dialog", { name: "Your session expired" });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("import-failure")).toContainText("Your session expired.");
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    await expect(page.getByTestId("import-selected-file")).toBeVisible();
    await expectNoAxeViolations(page);
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a malformed response is a contract failure with diagnostics", async ({ page }) => {
    const errors = collectErrors(page);
    await gotoFault(page, "import:malformed");
    await chooseFile(page);
    await page.getByRole("button", { name: "Upload file" }).click();

    const notice = page.getByTestId("import-failure");
    await expect(notice).toContainText("Unexpected response from the server");
    await expect(notice.getByRole("button", { name: "Copy diagnostics" })).toBeVisible();
    await expect(notice).toBeFocused();
    await expect(page.locator("body")).not.toContainText(/Unexpected token|JSON/);
    await expectNoAxeViolations(page);
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("the failure notice's file action opens the picker", async ({ page }) => {
    await gotoFault(page, "import:server");
    await chooseFile(page);
    await page.getByRole("button", { name: "Upload file" }).click();

    const notice = page.getByTestId("import-failure");
    await expect(notice).toBeVisible();

    const chooser = page.waitForEvent("filechooser");
    await notice.getByRole("button", { name: "Choose another file" }).click();
    await (
      await chooser
    ).setFiles({
      name: "replacement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await expect(page.getByTestId("import-selected-file")).toContainText("replacement.csv");
  });

  test("a slow upload shows the 3s and 10s states and Cancel aborts it", async ({ page }) => {
    test.setTimeout(50_000);
    await gotoFault(page, "import:slow");
    await chooseFile(page);
    await page.getByRole("button", { name: "Upload file" }).click();

    await expect(page.getByText("Still working…")).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByText("Taking longer than usual")).toBeVisible({
      timeout: 12_000,
    });
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("import-status")).toHaveText("Upload cancelled");
    await expect(page.getByTestId("import-preview")).toBeVisible();
    await expect(page.getByTestId("import-failure")).toHaveCount(0);
  });

  test("a slow upload can be retried without losing the result", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoFault(page, "import:slow");
    await chooseFile(page);
    await page.getByRole("button", { name: "Upload file" }).click();

    await expect(page.getByText("Taking longer than usual")).toBeVisible({
      timeout: 15_000,
    });

    await clearFault(page);
    await page.getByRole("button", { name: "Retry" }).click();

    await expect(page.getByTestId("import-result-sentence")).toHaveText("1 vehicle imported.", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("import-result-heading")).toBeFocused();
    await expect(page.locator("[data-recent-import]")).toHaveCount(1);
    await expect(page.getByTestId("import-failure")).toHaveCount(0);
  });

  test("a render crash is contained by the route boundary", async ({ page }) => {
    await page.goto("/import?crash=import");
    await expect(page.getByText("This part of the page stopped working")).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await captureForReview(page, "09-import-crash");
  });
});

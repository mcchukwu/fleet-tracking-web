import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations } from "./helpers";

const FROM = "2026-11-01T00:00:00Z";
const TO = "2026-11-08T00:00:00Z";

function rangeUrl(): string {
  return `/reports?from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`;
}

async function gotoFault(page: Page, fault: string): Promise<void> {
  await page.goto(`${rangeUrl()}&fault=${encodeURIComponent(fault)}`);
  await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
}

async function clearFault(page: Page): Promise<void> {
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("fault");
    history.replaceState({}, "", `${url.pathname}${url.search}`);
  });
}

async function setFault(page: Page, fault: string): Promise<void> {
  await page.evaluate((value) => {
    const url = new URL(window.location.href);
    url.searchParams.set("fault", value);
    history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, fault);
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
    (text) =>
      !text.includes("above error occurred") && !text.includes("Failed to load resource"),
  );
}

test.describe("reports faults", () => {
  test("a server error with nothing cached shows the region error and Retry recovers", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await gotoFault(page, "reports:server");
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Retry", exact: true }).first()).toBeVisible();
    await expect(page.getByText("Something broke.")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await captureForReview(page, "10-reports-error");
    await expectNoAxeViolations(page);

    await clearFault(page);
    await page.getByRole("button", { name: "Retry", exact: true }).first().click();
    await expect(page.getByTestId("reports-stats")).toBeVisible({ timeout: 15_000 });
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a refresh error keeps the cached report and labels it stale", async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto(rangeUrl());
    await expect(page.getByTestId("reports-stats")).toBeVisible({ timeout: 15_000 });

    await setFault(page, "reports:server");
    if ((page.viewportSize()?.width ?? 1440) < 768) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Map" })
      .click();
    await expect(page).toHaveURL(/\/map/);
    await page.goBack();

    await expect(page.getByText("Couldn't refresh")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("reports-stats")).toBeVisible();
    await expect(
      page.getByTestId("reports-stats").getByText("Vehicles"),
    ).toBeVisible();
    await expect(page.getByText(/Stale ·/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await captureForReview(page, "10-reports-stale-error");
  });

  test("offline keeps the cached report and marks it stale", async ({ page, context }) => {
    await page.goto(rangeUrl());
    await expect(page.getByTestId("reports-stats")).toBeVisible({ timeout: 15_000 });

    await context.setOffline(true);
    await expect(page.getByText("You're offline").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Stale ·/)).toBeVisible();
    await expect(page.getByTestId("reports-stats")).toBeVisible();
    await expect(page.getByText(/Can't reach the server/)).toHaveCount(0);
    await captureForReview(page, "10-reports-stale");
    await expectNoAxeViolations(page);

    await context.setOffline(false);
    await expect(page.getByText("You're offline")).toHaveCount(0, { timeout: 15_000 });
  });

  test("offline with no cache shows the neutral offline state", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    });
    await page.goto(`${rangeUrl()}&fault=${encodeURIComponent("reports:network")}`);

    await expect(page.getByText("You're offline")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("This range isn't available offline")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test("a slow request shows the working state and Cancel stops waiting", async ({ page }) => {
    test.setTimeout(45_000);
    await gotoFault(page, "reports:slow");
    await expect(page.getByText("Still working…")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("Taking longer than usual")).toBeVisible({
      timeout: 12_000,
    });
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Still working…")).toHaveCount(0);
    await expect(page.getByText("Taking longer than usual")).toHaveCount(0);
    await expect(page.getByText("Loading cancelled")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  });

  test("a forbidden report shows the forbidden state with a way back", async ({ page }) => {
    await gotoFault(page, "reports:forbidden");
    await expect(page.getByText("You don't have access to this.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go back" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("a session expiry shows the dialog and keeps the range", async ({ page }) => {
    await gotoFault(page, "reports:unauthenticated");
    const dialog = page.getByRole("dialog", { name: "Your session expired" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    expect(new URL(page.url()).searchParams.get("from")).toBe(FROM);
    expect(new URL(page.url()).searchParams.get("to")).toBe(TO);
  });

  test("a malformed body is a contract failure with diagnostics", async ({ page }) => {
    await gotoFault(page, "reports:malformed");
    await expect(page.getByText("Unexpected response from the server").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Copy diagnostics" })).toBeVisible();
    await expect(page.getByText(/Unexpected token|JSON/)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await expectNoAxeViolations(page);
  });

  test("one malformed chart row degrades without losing the report", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fleet.mockReports", "bad-row");
    });
    await page.goto(rangeUrl());

    await expect(page.getByTestId("reports-stats")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("chart-label")).toHaveText(["Speeding"]);
    await expect(page.getByText("Unexpected response from the server")).toHaveCount(0);
  });

  test("a render crash is contained by the route boundary", async ({ page }) => {
    await page.goto(`${rangeUrl()}&crash=reports`);
    await expect(page.getByText("This part of the page stopped working")).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await captureForReview(page, "10-reports-crash");
  });
});

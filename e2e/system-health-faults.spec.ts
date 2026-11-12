import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations } from "./helpers";

async function gotoFault(page: Page, fault: string): Promise<void> {
  await page.goto(`/system?fault=${encodeURIComponent(fault)}`);
  await expect(
    page.getByRole("heading", { name: "System health", level: 1 }),
  ).toBeVisible({ timeout: 15_000 });
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
      !text.includes("above error occurred") &&
      !text.includes("Failed to load resource"),
  );
}

test.describe("system health faults", () => {
  test("an unreachable first load shows Can't reach the API and Retry recovers", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await gotoFault(page, "system-health:server");
    await expect(page.getByText("Can't reach the API")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("button", { name: "Retry", exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Something broke.")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await captureForReview(page, "11-system-error");
    await expectNoAxeViolations(page);

    await clearFault(page);
    await page.getByRole("button", { name: "Retry", exact: true }).first().click();
    await expect(page.getByText("All systems healthy")).toBeVisible({
      timeout: 15_000,
    });
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a cached refresh error keeps the values and labels them stale", async ({
    page,
  }) => {
    await page.goto("/system");
    await expect(page.getByText("All systems healthy")).toBeVisible({
      timeout: 15_000,
    });

    await setFault(page, "system-health:server");
    await page.getByRole("button", { name: "Refresh" }).click();

    await expect(page.getByText("Couldn't refresh")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Stale ·/)).toBeVisible();
    await expect(page.getByText("20 of 25")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retry", exact: true }),
    ).toBeVisible();
    await captureForReview(page, "11-system-stale-error");
  });

  test("a slow request shows working, long and cancelled states", async ({ page }) => {
    test.setTimeout(60_000);
    await page.clock.install();
    await gotoFault(page, "system-health:slow");

    await page.clock.runFor(4_000);
    await expect(page.getByText("Still working…")).toBeVisible();
    await page.clock.runFor(7_000);
    await expect(page.getByText("Taking longer than usual")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Still working…")).toHaveCount(0);
    await expect(page.getByText("Taking longer than usual")).toHaveCount(0);
    await expect(page.getByText("Loading cancelled")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retry", exact: true }),
    ).toBeVisible();
  });

  test("a forbidden health call hides the data", async ({ page }) => {
    await gotoFault(page, "system-health:forbidden");
    await expect(page.getByText("You don't have access to this.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go back" })).toBeVisible();
    await expect(page.getByText("Received")).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test("a session expiry shows the dialog and keeps the page", async ({ page }) => {
    await page.goto(
      `/system?fault=${encodeURIComponent("system-health:unauthenticated")}`,
    );
    const dialog = page.getByRole("dialog", { name: "Your session expired" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    expect(new URL(page.url()).pathname).toBe("/system");
    // The blocking dialog hides the page from the accessibility tree, so assert
    // the DOM rather than a role: the screen is preserved underneath it.
    await expect(page.getByTestId("system-page")).toHaveCount(1);
  });

  test("a malformed body is a contract failure with diagnostics", async ({ page }) => {
    await gotoFault(page, "system-health:malformed");
    await expect(
      page.getByText("Unexpected response from the server").first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: "Copy diagnostics" }),
    ).toBeVisible();
    await expect(page.getByText(/Unexpected token|JSON/)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await expectNoAxeViolations(page);
  });

  test("a render crash is contained by the route boundary", async ({ page }) => {
    await page.goto("/system?crash=system");
    await expect(
      page.getByText("This part of the page stopped working"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("banner")).toBeVisible();
  });
});

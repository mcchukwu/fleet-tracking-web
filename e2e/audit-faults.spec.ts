import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations } from "./helpers";

async function setRole(page: Page, role = "admin"): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockRole", value);
  }, role);
}

async function gotoFault(page: Page, fault: string): Promise<void> {
  await page.goto(`/audit?fault=${encodeURIComponent(fault)}`);
  await expect(
    page.getByRole("heading", { name: "Audit", level: 1 }),
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

test.describe("audit faults", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await setRole(page);
  });

  test("a first-load server error offers Retry and recovers", async ({ page }) => {
    const errors = collectErrors(page);
    await gotoFault(page, "audit:server");

    await expect(page.getByText("Something went wrong on our side")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("button", { name: "Retry", exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Something broke.")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-error");

    await clearFault(page);
    await page.getByRole("button", { name: "Retry", exact: true }).first().click();
    await expect(page.getByTestId("audit-page")).toContainText("12 entries loaded", {
      timeout: 15_000,
    });
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a cached refresh error keeps the rows", async ({ page }) => {
    await page.goto("/audit");
    await expect(page.getByTestId("audit-page")).toContainText("12 entries loaded");

    await setFault(page, "audit:server");
    await page.getByRole("button", { name: "Refresh" }).click();

    await expect(page.getByText("Couldn't refresh")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("audit-page")).toContainText("12 entries loaded");
    await expect(
      page.getByRole("row").filter({ hasText: "Demo Admin" }).first(),
    ).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-stale");
  });

  test("a slow first load shows working, long and cancelled states", async ({ page }) => {
    test.setTimeout(60_000);
    await page.clock.install();
    await gotoFault(page, "audit:slow");

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

  test("a forbidden response shows the forbidden state", async ({ page }) => {
    await gotoFault(page, "audit:forbidden");
    await expect(page.getByText("You don't have access to this.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go back" })).toBeVisible();
    await expect(page.getByTestId("audit-page")).not.toContainText("Demo Admin");
    await expectNoAxeViolations(page);
  });

  test("a malformed body is a contract failure with diagnostics", async ({ page }) => {
    await gotoFault(page, "audit:malformed");
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

  test("offline without a cache shows the neutral offline state", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => false,
      });
    });
    await page.goto("/audit");
    await expect(
      page.getByText("Audit isn't available offline"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test("a session expiry shows the dialog and keeps the page", async ({ page }) => {
    await page.goto(
      `/audit?fault=${encodeURIComponent("audit:unauthenticated")}`,
    );
    const dialog = page.getByRole("dialog", { name: "Your session expired" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() =>
        dialog.evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true);
    expect(new URL(page.url()).pathname).toBe("/audit");
    await expect(page.getByTestId("audit-page")).toHaveCount(1);
  });

  test("a render crash is contained by the route boundary", async ({ page }) => {
    await page.goto("/audit?crash=audit");
    await expect(
      page.getByText("This part of the page stopped working"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("banner")).toBeVisible();
  });
});

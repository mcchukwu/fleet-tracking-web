import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectFocusVisible,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectTheme,
  expectTouchTargets,
} from "./helpers";

const PASSWORD = "DemoPass123!";

function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 768;
}

async function startAnonymous(page: Page): Promise<void> {
  await page.goto("/styleguide");
  await page.evaluate(() => localStorage.setItem("fleet.mockAuth", "anonymous"));
}

async function signIn(page: Page, email = "dispatcher@demo.ftb", password = PASSWORD) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("login", () => {
  test("an anonymous deep link opens sign in and keeps the target", async ({ page, theme }) => {
    await startAnonymous(page);
    await page.goto("/map?v=abc&status=moving");

    await expect(page).toHaveURL(/\/login\?redirect=%2Fmap%3Fv%3Dabc%26status%3Dmoving$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page).toHaveTitle("Sign in · Fleet Console");
    await expectTheme(page, theme);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    if (isMobile(page)) await expectTouchTargets(page);
    await captureForReview(page, "01-login-default");
  });

  test("a wrong password keeps the email, clears the password and focuses the error", async ({
    page,
  }) => {
    await startAnonymous(page);
    await page.goto("/login");
    await signIn(page, "dispatcher@demo.ftb", "wrong-password");

    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Email or password is incorrect.");
    await expect(alert).not.toContainText("session expired");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("dispatcher@demo.ftb");
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");

    const errorFocused = await page.evaluate(() => {
      const alertElement = document.querySelector('[role="alert"]');
      return alertElement ? document.activeElement?.contains(alertElement) ?? false : false;
    });
    expect(errorFocused).toBe(true);
    await expectFocusVisible(page.getByRole("alert").locator(".."));
    await expectNoAxeViolations(page);
    await captureForReview(page, "01-login-invalid");
  });

  test("a malformed or repeated redirect still opens the form", async ({ page }) => {
    await startAnonymous(page);
    await page.goto("/login?redirect=/map&redirect=/alerts");

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("This part of the page stopped working")).toHaveCount(0);
  });

  test("a correct password returns to the requested route", async ({ page }) => {
    await startAnonymous(page);
    await page.goto("/map?v=abc&status=moving");
    await signIn(page);

    await expect(page).toHaveURL(/\/map\?v=abc&status=moving$/);
    await expect(page.getByRole("heading", { name: "Map" })).toBeVisible();
  });

  test("a reload restores the session instead of flashing the login screen", async ({ page }) => {
    await startAnonymous(page);
    await page.goto("/map");
    await signIn(page);
    await expect(page.getByRole("heading", { name: "Map" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Map" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in" })).toHaveCount(0);
  });

  test("a rate limit counts down, disables submit and shows no raw server text", async ({
    page,
  }) => {
    await startAnonymous(page);
    await page.goto("/login?fault=login:rate_limited");
    await signIn(page);

    await expect(page.getByText(/Try again in \d+s\./)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
    await expect(page.getByText("Too many attempts.")).toHaveCount(0);
    await expectNoAxeViolations(page);
    await captureForReview(page, "01-login-rate-limited");
  });

  test("a network failure can be retried after the connection returns", async ({ page }) => {
    await startAnonymous(page);
    await page.goto("/login?fault=login:network");
    await signIn(page);

    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue(PASSWORD);

    await page.evaluate(() => history.replaceState({}, "", "/login"));
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { name: "Map" })).toBeVisible({ timeout: 10_000 });
  });

  test("a slow sign-in shows the working notice", async ({ page }) => {
    await startAnonymous(page);
    await page.goto("/login?fault=login:slow");
    await signIn(page);

    await expect(page.getByText("Still working…")).toBeVisible({ timeout: 6_000 });
    await captureForReview(page, "01-login-slow");
  });

  test("offline disables submit with a reason", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
      localStorage.setItem("fleet.mockAuth", "anonymous");
    });
    await page.goto("/login");

    await expect(page.getByText("You're offline. Reconnect to sign in.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
    await expectNoAxeViolations(page);
    await captureForReview(page, "01-login-offline");
  });
});

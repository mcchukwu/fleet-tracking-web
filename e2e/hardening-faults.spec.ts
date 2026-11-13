import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { expectNoAxeViolations } from "./helpers";

const PASSWORD = "DemoPass123!";

async function startAnonymous(page: Page): Promise<void> {
  await page.goto("/styleguide");
  await page.evaluate(() => localStorage.setItem("fleet.mockAuth", "anonymous"));
}

async function signIn(page: Page): Promise<void> {
  await page.getByLabel("Email", { exact: true }).fill("dispatcher@demo.ftb");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("hardening faults", { tag: "@fault" }, () => {
  test("a login server error stays inline and is never raw server text", async ({ page }) => {
    await startAnonymous(page);
    await page.goto("/login?fault=login:server");
    await signIn(page);
    const inline = page.getByText("Something went wrong on our side").first();
    await expect(inline).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Something broke.");
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await expectNoAxeViolations(page);
  });

  test("a malformed login response becomes a contract error, not raw JSON", async ({ page }) => {
    await startAnonymous(page);
    await page.goto("/login?fault=login:malformed");
    await signIn(page);
    await expect(page.getByText("Unexpected response from the server").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("unexpected");
    await expectNoAxeViolations(page);
  });

  test("simultaneous failures raise one storm banner and it clears", async ({ page }) => {
    await page.goto("/map?map=fake");
    await expect(page.getByTestId("map-root")).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(() => page.evaluate(() => typeof window.__FLEET_TEST_STORM__))
      .toBe("function");

    await page.evaluate(() => window.__FLEET_TEST_STORM__?.(true));
    const banner = page.getByTestId("banner-region");
    await expect(banner).toHaveAttribute("data-banner-kind", "storm");
    await expect(banner).toContainText("We're having trouble reaching the server.");
    await expect(banner.getByRole("button", { name: "Open System" })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.evaluate(() => window.__FLEET_TEST_STORM__?.(false));
    await expect
      .poll(async () =>
        (await banner.count()) > 0 ? banner.getAttribute("data-banner-kind") : null,
      )
      .not.toBe("storm");
  });

  test("a crashed route resets when another route is opened", async ({ page }) => {
    await page.goto("/trips?crash=trips");
    await expect(page.getByText("This part of the page stopped working")).toBeVisible();

    await page.keyboard.press("g");
    await page.keyboard.press("d");
    await expect(page.getByRole("heading", { name: "Drivers", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("This part of the page stopped working")).toHaveCount(0);
    await expect(page.getByTestId("drivers-page")).toBeVisible();
  });
});

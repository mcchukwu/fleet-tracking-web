import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectTheme,
} from "./helpers";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function clearFault(page: Page): Promise<void> {
  await page.evaluate(() => history.replaceState({}, "", window.location.pathname));
}

test.describe("fault scenarios", () => {
  test("a route failure uses the app error surface", async ({ page, theme }) => {
    const errors = collectErrors(page);
    await page.goto("/map?fault=me:server");

    await expect(page.getByText("Something went wrong on our side")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expectTheme(page, theme);
    await expectNoAxeViolations(page);
    await captureForReview(page, "00-route-error");

    await page.goto("/map");
    await expect(page.getByRole("heading", { name: "Map" })).toBeVisible();
    expect(
      errors.filter(
        (text) =>
          !text.includes("Something broke") &&
          !text.includes("above error occurred") &&
          !text.includes("Failed to load resource"),
      ),
    ).toEqual([]);
  });

  test("an offline session restore renders the offline state", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    });
    await page.goto("/map?fault=me:network");

    await expect(page.getByText("You're offline")).toBeVisible();
    await expect(page.getByText("Can't reach the server")).toHaveCount(0);
    await expectNoAxeViolations(page);
    await captureForReview(page, "00-offline");
  });

  test("a malformed session payload shows the contract state", async ({ page }) => {
    await page.goto("/map?fault=me:malformed");

    await expect(page.getByText("Unexpected response from the server")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "00-contract-error");
  });

  test("a panel failure with nothing cached shows a full error and Retry recovers", async ({
    page,
  }) => {
    await page.goto("/dev/faults?fault=alerts:server");

    await expect(page.getByText("Something went wrong on our side")).toBeVisible({
      timeout: 15_000,
    });
    await clearFault(page);

    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.locator("ul li").first()).toBeVisible();
  });

  test("a failed refresh keeps the cached rows and labels them", async ({ page }) => {
    await page.goto("/dev/faults");
    await expect(page.locator("ul li").first()).toBeVisible();

    await page.evaluate(() =>
      history.replaceState({}, "", "/dev/faults?fault=alerts:server"),
    );
    await page.getByRole("button", { name: "Refetch alerts" }).click();

    await expect(page.getByText("Couldn't refresh")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("ul li").first()).toBeVisible();
    await captureForReview(page, "00-cached-error");
  });

  test("a lost write reports an uncertain outcome", async ({ page }) => {
    await page.goto("/dev/faults?fault=alerts:lost");
    await page.getByRole("button", { name: "Acknowledge alert" }).click();

    await expect(page.getByText(/We couldn't confirm that it saved/)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("an unknown enum renders a neutral fallback", async ({ page }) => {
    await page.goto("/dev/faults?fault=alerts:unknown_enum");

    await expect(
      page.getByText("Unknown type: solar_flare", { exact: true }),
    ).toBeVisible();
  });

  test("an injected render crash is contained by the panel boundary", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto("/dev/faults");
    await page.getByRole("button", { name: "Crash this panel" }).click();

    await expect(page.getByText("This part of the page stopped working")).toBeVisible();
    await expect(page.getByText("Sibling region is still working")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "00-panel-crash");

    expect(
      errors.filter(
        (text) =>
          !text.includes("above error occurred") && !text.includes("Injected panel crash"),
      ),
    ).toEqual([]);
  });
});

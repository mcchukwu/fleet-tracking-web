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

// Faults are expected; anything else in the console is not.
function unexpectedConsole(errors: string[]): string[] {
  return errors.filter(
    (text) =>
      !text.includes("above error occurred") &&
      !text.includes("Failed to load resource") &&
      !text.includes("Something broke") &&
      !text.includes("Injected panel crash"),
  );
}

async function clearFault(page: Page): Promise<void> {
  await page.evaluate(() => history.replaceState({}, "", window.location.pathname));
}

test.describe("fault scenarios", { tag: "@fault" }, () => {
  test("a route failure uses the app error surface and records diagnostics", async ({
    page,
    theme,
  }) => {
    const errors = collectErrors(page);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/map?fault=me:server");

    await expect(page.getByText("Something went wrong on our side")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expectTheme(page, theme);
    await expectNoAxeViolations(page);

    await page.getByRole("button", { name: "Copy diagnostics" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('"endpoint": "/me"');

    await captureForReview(page, "00-route-error");

    await page.goto("/map");
    await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a forbidden route error goes back instead of retrying", async ({ page }) => {
    await page.goto("/styleguide");
    await page.goto("/map?fault=me:forbidden");

    await expect(page.getByText("You don't have access to this")).toBeVisible();
    await page.getByRole("button", { name: "Go back" }).click();
    await expect(page.getByRole("heading", { name: "Fleet Console foundations" })).toBeVisible();
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
    await expect(page.locator('section[aria-labelledby="fault-alerts"] li').first()).toBeVisible();
  });

  test("a failed refresh keeps the cached rows and labels them", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/dev/faults");
    await expect(page.locator('section[aria-labelledby="fault-alerts"] li').first()).toBeVisible();

    await page.evaluate(() => history.replaceState({}, "", "/dev/faults?fault=alerts:server"));
    await page.getByRole("button", { name: "Refetch alerts" }).click();

    await expect(page.getByText("Couldn't refresh")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('section[aria-labelledby="fault-alerts"] li').first()).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "00-cached-error");
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a lost write reports an uncertain outcome", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/dev/faults?fault=alerts:lost");
    await page.getByRole("button", { name: "Acknowledge alert" }).click();

    await expect(page.getByText(/We couldn't confirm that it saved/)).toBeVisible({
      timeout: 5_000,
    });
    await expectNoAxeViolations(page);
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("an unknown enum renders a neutral fallback", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/dev/faults?fault=alerts:unknown_enum");

    await expect(page.getByText("UNKNOWN · Unknown type: solar_flare")).toBeVisible();
    await expectNoAxeViolations(page);
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("an injected render crash is contained by the panel boundary", async ({ page }) => {
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
        (text) => !text.includes("above error occurred") && !text.includes("Injected panel crash"),
      ),
    ).toEqual([]);
  });
});

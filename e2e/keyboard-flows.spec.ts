import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { expectFocusVisible } from "./helpers";

/**
 * Keyboard-only runs of the three core flows. No `.click()`; the OS file picker
 * is the sole exception because `setInputFiles` replaces it.
 */

const PASSWORD = "DemoPass123!";

async function seed(page: Page, role: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockRole", value);
  }, role);
}

async function press(page: Page, ...keys: string[]): Promise<void> {
  for (const key of keys) await page.keyboard.press(key);
}

async function activate(page: Page, locator: Locator): Promise<void> {
  await locator.focus();
  await expectFocusVisible(locator);
  await page.keyboard.press("Enter");
}

const CSV = `imei,plate,vehicle_type,make,model,year,colour,depot
e2e-keyboard-1,LSD-970-AA,truck,Volvo,FH,2021,White,Lagos`;

test.describe("keyboard-only core flows", () => {
  // oxlint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern.
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name.startsWith("mobile"), "keyboard-only runs on desktop");
  });

  test("morning dispatch: sign in, create a trip, acknowledge an unplanned stop", async ({
    page,
  }) => {
    await page.goto("/styleguide");
    await page.evaluate(() => localStorage.setItem("fleet.mockAuth", "anonymous"));
    await page.goto("/login");

    const email = page.getByLabel("Email", { exact: true });
    await expect(email).toBeFocused();
    await page.keyboard.type("dispatcher@demo.ftb");
    await press(page, "Tab");
    await page.keyboard.type(PASSWORD);
    await press(page, "Enter");

    await expect(page.getByTestId("map-root")).toBeVisible({ timeout: 20_000 });
    await press(page, "g", "t");
    await expect(page.getByRole("heading", { name: "Trips", exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await activate(page, page.getByRole("button", { name: "Create trip" }).first());
    const dialog = page.getByRole("dialog").filter({ hasText: "Create trip" });
    await expect(dialog).toBeVisible();

    const vehicle = dialog.getByLabel("Vehicle", { exact: true });
    await vehicle.focus();
    await expectFocusVisible(vehicle);
    await page.keyboard.type("LSD-100");
    await press(page, "Enter");
    const origin = dialog.getByLabel("Origin", { exact: true });
    await origin.focus();
    await page.keyboard.type("Refinery Gate");
    const destination = dialog.getByLabel("Destination", { exact: true });
    await destination.focus();
    await page.keyboard.type("Ibadan Customer");
    await activate(page, dialog.getByRole("button", { name: "Create trip" }));

    await expect(page.getByText("Trip created.").first()).toBeVisible({ timeout: 20_000 });

    await press(page, "g", "a");
    await expect(page.getByRole("heading", { name: "Alerts", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    const acknowledge = page
      .getByRole("button", { name: /Acknowledge alert for LSD-102-AA/ })
      .first();
    await activate(page, acknowledge);
    await expect(page.getByText("Acknowledged.").first()).toBeVisible({ timeout: 20_000 });
  });

  test("security incident: open the deviation, replay, acknowledge", async ({ page }) => {
    await seed(page, "security");
    await page.goto("/alerts");
    await expect(page.getByRole("heading", { name: "Alerts", exact: true })).toBeVisible({
      timeout: 20_000,
    });

    const deviation = page.getByRole("row").filter({ hasText: "Route deviation" }).first();
    await activate(page, deviation.getByRole("button", { name: /^Open alert for/ }));
    const drawer = page.getByRole("complementary", { name: "Alert details" });
    await expect(drawer).toBeVisible();

    await activate(page, drawer.getByRole("button", { name: "Replay last 30 minutes" }));
    await expect(page).toHaveURL(/\/playback\?/);
    await expect(page.getByRole("heading", { name: "Playback", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.playback?.pointCount ?? 0), {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);

    await press(page, "g", "a");
    await expect(page.getByRole("heading", { name: "Alerts", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    const acknowledge = page
      .getByRole("row")
      .filter({ hasText: "Route deviation" })
      .first()
      .getByRole("button", { name: /^Acknowledge alert for/ });
    await activate(page, acknowledge);
    await expect(page.getByText("Acknowledged.").first()).toBeVisible({ timeout: 20_000 });
  });

  test("onboarding: import, focus the plate search, assign a driver", async ({ page }) => {
    await page.goto("/import");
    await expect(page.getByRole("heading", { name: "Import", exact: true })).toBeVisible({
      timeout: 20_000,
    });

    // The OS file picker is the one action a keyboard cannot perform.
    await page.getByTestId("import-file-input").setInputFiles({
      name: "keyboard-import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(CSV),
    });
    await expect(page.getByTestId("import-preview")).toBeVisible();

    await activate(page, page.getByRole("button", { name: "Upload file" }));
    await expect(page.getByTestId("import-result")).toBeVisible({ timeout: 20_000 });

    await activate(page, page.getByRole("button", { name: "Search a plate" }));
    await expect(page.getByTestId("map-root")).toBeVisible({ timeout: 20_000 });
    const search = page.locator("#vehicle-search");
    await expect(search).toBeFocused();
    await page.keyboard.type("LSD-970-AA");
    await press(page, "Enter");

    const select = page.getByRole("button", { name: "Select LSD-970-AA" });
    await expect(select).toBeVisible({ timeout: 20_000 });
    await activate(page, select);
    const drawer = page.getByTestId("drawer");
    await expect(drawer).toBeVisible();

    await activate(page, drawer.getByRole("button", { name: "Assign driver" }));
    const dialog = page.getByRole("dialog", { name: /Assign a driver to LSD-970-AA/ });
    await expect(dialog).toBeVisible();
    const driver = dialog.getByLabel("Driver", { exact: true });
    await driver.focus();
    await page.keyboard.type("Musa");
    await press(page, "Enter");
    await activate(page, dialog.getByRole("button", { name: "Assign driver" }));
    await expect(page.getByText("Driver assigned.").first()).toBeVisible({ timeout: 20_000 });
  });
});

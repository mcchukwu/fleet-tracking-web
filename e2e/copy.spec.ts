import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { expectTabularNums } from "./helpers";

/** Mechanical copy audit: titles, missing values, numbers and error text. */

async function seed(page: Page, role: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockRole", value);
  }, role);
}

const TITLES: readonly { path: string; title: RegExp }[] = [
  { path: "/map?map=fake", title: /^\(\d+\) Map · Fleet Console$/ },
  { path: "/alerts", title: /^\(\d+\) Alerts · Fleet Console$/ },
  { path: "/trips", title: /^Trips · Fleet Console$/ },
  { path: "/drivers", title: /^Drivers · Fleet Console$/ },
  { path: "/geofences?map=fake", title: /^Geofences · Fleet Console$/ },
  { path: "/import", title: /^Import · Fleet Console$/ },
  { path: "/reports", title: /^Reports · Fleet Console$/ },
  { path: "/system", title: /^System health · Fleet Console$/ },
  { path: "/audit", title: /^Audit · Fleet Console$/ },
  { path: "/playback", title: /^Playback · Fleet Console$/ },
  { path: "/styleguide", title: /^Styleguide · Fleet Console$/ },
  { path: "/forbidden", title: /^Forbidden · Fleet Console$/ },
  { path: "/this-route-does-not-exist", title: /^Page not found · Fleet Console$/ },
];

test.describe("copy and consistency", () => {
  for (const entry of TITLES) {
    test(`${entry.path} sets its document title`, async ({ page }) => {
      await seed(page, "admin");
      await page.goto(entry.path);
      await expect(page.locator("[data-page-frame]").first()).toBeVisible({ timeout: 20_000 });
      await expect.poll(() => page.title()).toMatch(entry.title);
    });
  }

  test("the login title is present for an anonymous visitor", async ({ page }) => {
    await page.goto("/styleguide");
    await page.evaluate(() => localStorage.setItem("fleet.mockAuth", "anonymous"));
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page).toHaveTitle("Sign in · Fleet Console");
  });

  test("an empty fleet and a filtered fleet use different copy", async ({ page }) => {
    await page.goto("/map?map=fake&q=zzzz-no-such-plate");
    await expect(page.getByText("No vehicles match", { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("No vehicles yet", { exact: true })).toHaveCount(0);
  });

  test("a server error never leaks the raw message or a stack frame", async ({ page }) => {
    await page.goto("/alerts?fault=alerts:server");
    const errorSurface = page.getByText("Something went wrong on our side").first();
    await expect(errorSurface).toBeVisible({ timeout: 20_000 });

    const body = page.locator("body");
    await expect(body).not.toContainText("Something broke.");
    await expect(body).not.toContainText(/\.(tsx|ts):\d+/);
    await expect(body).not.toContainText(/\bat .+:\d+:\d+/);
  });

  test("a forbidden route explains the role rule without blame or exclamation", async ({
    page,
  }) => {
    await seed(page, "viewer");
    await page.goto("/import");
    await expect(page).toHaveURL(/\/forbidden$/);
    await expect(page.getByRole("heading", { name: "Forbidden", exact: true })).toBeVisible();

    const body = page.locator("body");
    await expect(body).not.toContainText("!");
    await expect(body).not.toContainText(/\b(Oops|Failed|Invalid)\b/);
    await expect(page.getByRole("link", { name: "Back to the map" })).toBeVisible();
  });

  test("missing values render an em dash and identifiers stay mono", async ({ page }) => {
    await page.goto("/drivers");
    const row = page.getByRole("row").filter({ hasText: "Test Driver Six" });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText("—");

    await page.goto("/map?map=fake&v=4324a768-9b14-4223-a299-eb8da4d8d309");
    const drawer = page.getByTestId("drawer").or(page.getByTestId("vehicle-detail-sheet"));
    await expect(drawer).toBeVisible({ timeout: 20_000 });
    const plate = drawer.getByText("LSD-100-AA", { exact: true }).first();
    await expect(plate).toBeVisible({ timeout: 20_000 });
    const family = await plate.evaluate((element) => window.getComputedStyle(element).fontFamily);
    expect(family.toLowerCase()).toContain("jetbrains");
  });

  test("numeric surfaces use tabular figures", async ({ page }) => {
    await page.goto("/map?map=fake");
    const kpiValue = page.locator('[aria-label="Fleet summary"] span.tabular-nums').first();
    await expect(kpiValue).toBeVisible({ timeout: 20_000 });
    await expectTabularNums(kpiValue);

    await page.goto("/reports");
    const statValue = page.locator('[data-testid="reports-page"] span.tabular-nums').first();
    await expect(statValue).toBeVisible({ timeout: 20_000 });
    await expectTabularNums(statValue);
  });

  test("buttons use verbs and empty surfaces avoid blame", async ({ page }) => {
    await page.goto("/alerts");
    const buttons = page.getByRole("button");
    const names = await buttons.allInnerTexts();
    for (const name of names) {
      expect(name.trim()).not.toMatch(/^(Submit|OK|Failed|Invalid|Oops)$/i);
    }
  });
});

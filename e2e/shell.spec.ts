import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./helpers";

function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 768;
}

async function setRoleOnLoad(page: Page, role: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockRole", value);
  }, role);
}

async function expectNav(page: Page, visible: string[], hidden: string[] = []): Promise<void> {
  if (isMobile(page)) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const label of visible) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  for (const label of hidden) {
    await expect(nav.getByRole("link", { name: label })).toHaveCount(0);
  }
  if (isMobile(page)) await page.keyboard.press("Escape");
}

test.describe("app shell", () => {
  test("the admin sees every destination", async ({ page }) => {
    await setRoleOnLoad(page, "admin");
    await page.goto("/map");
    await expectNav(
      page,
      ["Map", "Alerts", "Trips", "Drivers", "Geofences", "Import", "Reports", "System", "Audit"],
    );
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "01-shell-map");
  });

  test("a dispatcher sees import but not audit", async ({ page }) => {
    await setRoleOnLoad(page, "dispatcher");
    await page.goto("/map");
    await expectNav(page, ["Map", "Import"], ["Audit"]);
  });

  test("security sees audit but not import", async ({ page }) => {
    await setRoleOnLoad(page, "security");
    await page.goto("/map");
    await expectNav(page, ["Map", "Audit"], ["Import"]);
  });

  test("a viewer sees read-only screens only", async ({ page }) => {
    await setRoleOnLoad(page, "viewer");
    await page.goto("/map");
    await expectNav(page, ["Map", "Alerts", "Reports"], ["Import", "Audit"]);
  });

  test("global search writes q and opens the map", async ({ page }) => {
    await page.goto("/alerts");
    if (isMobile(page)) {
      await page.getByRole("button", { name: "Search vehicles" }).click();
    }

    const search = page.getByRole("searchbox", { name: "Search vehicles" });
    await search.fill("KJA 123");
    await search.press("Enter");

    await expect(page).toHaveURL(/\/map\?q=KJA/);
  });

  test("the user menu signs out and the session stays closed after reload", async ({ page }) => {
    await page.goto("/map");
    await page.getByRole("button", { name: "Account menu for Demo Dispatcher" }).click();

    const menu = page.getByRole("menu");
    await expect(menu.getByText("dispatcher@demo.ftb")).toBeVisible();
    await expect(menu.getByText("dispatcher", { exact: true })).toBeVisible();
    await captureForReview(page, "01-shell-user-menu");

    await menu.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  });

  test("the theme control switches the resolved theme", async ({ page }) => {
    await page.goto("/map");

    if (isMobile(page)) {
      await page.getByRole("button", { name: "Account menu for Demo Dispatcher" }).click();
      await page.getByRole("menuitem", { name: "Theme" }).hover();
      const dark = page.getByRole("menuitemradio", { name: "Dark" });
      await dark.waitFor();
      await dark.focus();
      await page.keyboard.press("Enter");
    } else {
      await page.getByRole("button", { name: "Dark theme" }).click();
    }

    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("dark");
  });

  test("mobile navigation opens as a menu and changes route", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only navigation");
    await page.goto("/map");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
    await captureForReview(page, "01-shell-mobile-menu");

    await page.getByRole("link", { name: "Alerts" }).click();
    await expect(page).toHaveURL(/\/alerts$/);
    await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Navigation" })).toHaveCount(0);
  });

  test("a viewer who deep-links to audit gets the shell forbidden state", async ({ page }) => {
    await setRoleOnLoad(page, "viewer");
    await page.goto("/audit");

    await expect(page).toHaveURL(/\/forbidden$/);
    await expect(page.getByText("You don't have access to this.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the map" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Account menu for Demo Viewer" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "01-shell-forbidden");
  });
});

import { expect, test } from "@playwright/test";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  setStoredTheme,
} from "./helpers";

const themes = ["light", "dark"] as const;

test.describe("foundation smoke", () => {
  test("styleguide renders in both themes", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    for (const theme of themes) {
      await setStoredTheme(page, theme);
      await page.goto("/");
      await expect(page).toHaveURL(/\/styleguide$/);
      await expect(
        page.getByRole("heading", { name: "Fleet Console foundations" }),
      ).toBeVisible();
      await expect(page).toHaveTitle("Styleguide · Fleet Console");
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      await captureForReview(page, "00-styleguide");
    }

    expect(errors).toEqual([]);
  });

  test("placeholder map route renders with the debug hook", async ({ page }) => {
    await setStoredTheme(page, "light");
    await page.goto("/map");
    await expect(page.getByRole("heading", { name: "Map" })).toBeVisible();
    await expect(page).toHaveTitle("Map · Fleet Console");
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    const debug = await page.evaluate(() => window.__FLEET_DEBUG__);
    expect(debug?.connection.network).toBe("online");
    expect(debug?.map.mapLoaded).toBe(false);

    await captureForReview(page, "00-map-placeholder");
  });

  test("unknown routes show the not-found page", async ({ page }) => {
    await setStoredTheme(page, "dark");
    await page.goto("/does-not-exist");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page).toHaveTitle("Page not found · Fleet Console");
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "00-not-found");
  });

  test("an unauthenticated deep link redirects to sign in", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fleet.mockAuth", "anonymous");
    });
    await page.goto("/map");
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("a viewer cannot open the audit log or import", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fleet.mockRole", "viewer");
    });
    await page.goto("/audit");
    await expect(page).toHaveURL(/\/forbidden$/);
    await expect(page.getByText("You don't have access to this.")).toBeVisible();

    await page.goto("/import");
    await expect(page).toHaveURL(/\/forbidden$/);
    await captureForReview(page, "00-forbidden");
  });

  test("a dispatcher cannot open the audit log but can import", async ({ page }) => {
    await page.goto("/audit");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/import");
    await expect(page.getByRole("heading", { name: "Import" })).toBeVisible();
  });

  test("an admin can open the audit log", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fleet.mockRole", "admin");
    });
    await page.goto("/audit");
    await expect(page.getByRole("heading", { name: "Audit" })).toBeVisible();
  });
});

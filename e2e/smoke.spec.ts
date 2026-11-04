import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectTheme,
  expectTouchTargets,
} from "./helpers";

test.describe("foundation smoke", () => {
  test("styleguide renders in the project theme", async ({ page, theme }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.goto("/styleguide");
    await expect(
      page.getByRole("heading", { name: "Fleet Console foundations" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Styleguide · Fleet Console");
    await expectTheme(page, theme);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "00-styleguide");

    expect(errors).toEqual([]);
  });

  test("the styleguide captures the shell primitives in both accents", async ({ page }) => {
    await page.goto("/styleguide");

    for (const [id, name] of [
      ["overlays", "01-styleguide-overlays"],
      ["menus", "01-styleguide-menus"],
      ["toasts", "01-styleguide-toasts"],
      ["banners", "01-styleguide-banners"],
      ["shell", "01-styleguide-shell-login"],
    ] as const) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await captureForReview(page, name);
    }

    await page.getByRole("button", { name: "Violet accent" }).click();
    await page.locator("#shell").scrollIntoViewIfNeeded();
    await captureForReview(page, "01-styleguide-shell-violet");
  });

  test("the index route opens the map inside the shell", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/map$/);
    await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();

    if ((page.viewportSize()?.width ?? 1440) < 768) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  });

  test("the map route renders the live map shell", async ({ page, theme }) => {
    await page.goto("/map");
    await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
    await expect(page).toHaveTitle(/Map · Fleet Console$/);
    await expectTheme(page, theme);
    await expect(page.getByText("Showing 25 of 25")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), {
        timeout: 20_000,
      })
      .toBe(true);

    const debug = await page.evaluate(() => window.__FLEET_DEBUG__);
    expect(debug?.connection.network).toBe("online");
    expect(debug?.map.renderedVehicleCount).toBe(20);

    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "00-map");
  });

  test("unknown routes show the not-found page", async ({ page }) => {
    await page.goto("/does-not-exist");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page).toHaveTitle("Page not found · Fleet Console");
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    if ((page.viewportSize()?.width ?? 1440) < 768) await expectTouchTargets(page);
    await captureForReview(page, "00-not-found");
  });

  test("an unauthenticated deep link redirects to sign in with its query intact", async ({
    page,
  }) => {
    let meCalls = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/v1/me")) meCalls += 1;
    });

    await page.addInitScript(() => {
      localStorage.setItem("fleet.mockAuth", "anonymous");
    });
    await page.goto("/map?v=4324a768-9b14-4223-a299-eb8da4d8d309&status=moving");
    await expect(page).toHaveURL(
      /\/login\?redirect=%2Fmap%3Fv%3D4324a768-9b14-4223-a299-eb8da4d8d309%26status%3Dmoving$/,
    );
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.waitForTimeout(500);
    expect(meCalls).toBeLessThanOrEqual(4);
  });

  test("a viewer cannot open the audit log or import", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fleet.mockRole", "viewer");
    });
    await page.goto("/audit");
    await expect(page).toHaveURL(/\/forbidden$/);
    await expect(page.getByText("You don't have access to this.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the map" })).toBeVisible();

    await page.goto("/import");
    await expect(page).toHaveURL(/\/forbidden$/);
    if ((page.viewportSize()?.width ?? 1440) < 768) await expectTouchTargets(page);
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

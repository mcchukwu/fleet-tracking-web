import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectMinimumContrast,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./helpers";

async function startAnonymous(page: Page): Promise<void> {
  await page.goto("/styleguide");
  await page.evaluate(() => localStorage.setItem("fleet.mockAuth", "anonymous"));
}

async function startSignedIn(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.removeItem("fleet.mockAuth"));
}

test.describe("brand", () => {
  test("the login lockup sits exactly where the app top bar lockup sits", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1440, "desktop reference viewport");

    await startAnonymous(page);
    await page.goto("/login");
    const loginLogo = page.locator('[data-brand-variant="lockup"]');
    await expect(loginLogo).toBeVisible();
    const loginBox = await loginLogo.boundingBox();

    await startSignedIn(page);
    await page.goto("/map");
    const shellLogo = page.locator('[data-brand-variant="lockup"]');
    await expect(shellLogo).toBeVisible();
    const shellBox = await shellLogo.boundingBox();

    expect(loginBox, "login logo has no box").not.toBeNull();
    expect(shellBox, "top bar logo has no box").not.toBeNull();
    if (!loginBox || !shellBox) return;

    expect(Math.abs(loginBox.x - shellBox.x), "left edge differs").toBeLessThanOrEqual(1);
    expect(Math.abs(loginBox.y - shellBox.y), "top edge differs").toBeLessThanOrEqual(1);
    expect(Math.abs(loginBox.width - shellBox.width), "width differs").toBeLessThanOrEqual(1);
    expect(Math.abs(loginBox.height - shellBox.height), "height differs").toBeLessThanOrEqual(1);
    expect(shellBox.x).toBeCloseTo(16, 0);
    expect(shellBox.height).toBeCloseTo(22, 0);

    await expectMinimumContrast(loginLogo, 4.5);
    await expectMinimumContrast(shellLogo, 4.5);
    await expectNoAxeViolations(page);
    await captureForReview(page, "brand-shell");
  });

  test("the mobile top bar shows the symbol and never scrolls sideways", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1440) >= 768, "mobile viewport only");

    await startAnonymous(page);
    await page.goto("/login");
    await expectMinimumContrast(page.locator('[data-brand-variant="lockup"]'), 4.5);
    await expectNoAxeViolations(page);
    await captureForReview(page, "brand-login");

    await startSignedIn(page);
    await page.goto("/map");
    const symbol = page.locator('[data-brand-variant="symbol"]');
    await expect(symbol).toBeVisible();
    await expect(page.locator('[data-brand-variant="lockup"]')).toBeHidden();
    const symbolBox = await symbol.boundingBox();
    expect(symbolBox, "mobile logo has no box").not.toBeNull();
    if (symbolBox) {
      expect(symbolBox.x).toBeCloseTo(16, 0);
      expect(symbolBox.height).toBeCloseTo(22, 0);
    }
    await expectMinimumContrast(symbol, 4.5);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "brand-topbar");
  });

  test("the document points at the brand icons and theme colours", async ({ page }) => {
    await page.goto("/login");

    const links = await page
      .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          rel: element.getAttribute("rel"),
          href: element.getAttribute("href"),
          sizes: element.getAttribute("sizes"),
        })),
      );
    expect(links).toContainEqual({ rel: "icon", href: "/favicon.svg", sizes: null });
    expect(links).toContainEqual({ rel: "icon", href: "/favicon-32.png", sizes: "32x32" });
    expect(links).toContainEqual({
      rel: "apple-touch-icon",
      href: "/apple-touch-icon.png",
      sizes: "180x180",
    });

    const themeColours = await page
      .locator('meta[name="theme-color"]')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          media: element.getAttribute("media"),
          content: element.getAttribute("content"),
        })),
      );
    expect(themeColours).toContainEqual({
      media: "(prefers-color-scheme: light)",
      content: "#fafafa",
    });
    expect(themeColours).toContainEqual({
      media: "(prefers-color-scheme: dark)",
      content: "#09090b",
    });

    for (const href of [
      "/favicon.svg",
      "/favicon-32.png",
      "/apple-touch-icon.png",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-maskable-512.png",
    ]) {
      const response = await page.request.get(href);
      expect(response.status(), href).toBe(200);
    }
  });
});

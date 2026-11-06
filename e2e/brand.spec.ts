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
    expect(shellBox.height).toBeCloseTo(24, 0);

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
    await expect(page.locator('[data-brand-variant="symbol"]')).toBeVisible();
    await expect(page.locator('[data-brand-variant="lockup"]')).toBeHidden();
    await expectMinimumContrast(page.locator('[data-brand-variant="symbol"]'), 4.5);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "brand-topbar");
  });
});

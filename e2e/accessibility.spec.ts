import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations, expectNoHorizontalScroll } from "./helpers";

/**
 * One centralized axe sweep. The `@theme` tag makes the dark projects run it
 * too; the light projects run every test anyway. Per-slice specs keep covering
 * drawers, dialogs, sheets and fault states.
 */

interface Screen {
  name: string;
  path: string;
  ready: string;
  anonymous?: boolean;
  screenshot?: string;
}

const SCREENS: readonly Screen[] = [
  { name: "login", path: "/login", ready: "Sign in", anonymous: true },
  { name: "map", path: "/map?map=fake", ready: '[data-testid="map-root"]', screenshot: "14-map" },
  {
    name: "alerts",
    path: "/alerts",
    ready: '[data-testid="alerts-page"]',
    screenshot: "14-alerts",
  },
  { name: "trips", path: "/trips", ready: '[data-testid="trips-page"]', screenshot: "14-trips" },
  {
    name: "drivers",
    path: "/drivers",
    ready: '[data-testid="drivers-page"]',
    screenshot: "14-drivers",
  },
  {
    name: "geofences",
    path: "/geofences?map=fake",
    ready: '[data-testid="geofences-page"]',
    screenshot: "14-geofences",
  },
  {
    name: "import",
    path: "/import",
    ready: '[data-testid="import-page"]',
    screenshot: "14-import",
  },
  {
    name: "reports",
    path: "/reports",
    ready: '[data-testid="reports-page"]',
    screenshot: "14-reports",
  },
  {
    name: "system",
    path: "/system",
    ready: '[data-testid="system-page"]',
    screenshot: "14-system",
  },
  { name: "audit", path: "/audit", ready: '[data-testid="audit-page"]', screenshot: "14-audit" },
  { name: "playback", path: "/playback", ready: '[data-testid="playback-page"]' },
  {
    name: "styleguide",
    path: "/styleguide",
    ready: "Fleet Console foundations",
    screenshot: "14-styleguide",
  },
  { name: "forbidden", path: "/forbidden", ready: "Forbidden" },
  { name: "not-found", path: "/this-route-does-not-exist", ready: "Page not found" },
];

async function seedRole(page: Page, role: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockRole", value);
  }, role);
}

test.describe("accessibility sweep", { tag: "@theme" }, () => {
  for (const screen of SCREENS) {
    test(`${screen.name} is axe-clean and never overflows`, async ({ page }) => {
      if (screen.anonymous) {
        await page.goto("/styleguide");
        await page.evaluate(() => localStorage.setItem("fleet.mockAuth", "anonymous"));
      } else {
        // Admin renders every route, including audit and import.
        await seedRole(page, "admin");
      }

      await page.goto(screen.path);
      await expect(page.locator("[data-page-frame]").first()).toBeVisible({ timeout: 20_000 });
      const ready = screen.ready.startsWith("[data-testid")
        ? page.locator(screen.ready)
        : page.getByRole("heading", { name: screen.ready, exact: true }).first();
      await expect(ready).toBeVisible({ timeout: 20_000 });

      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      if (screen.screenshot) await captureForReview(page, screen.screenshot);
    });
  }
});

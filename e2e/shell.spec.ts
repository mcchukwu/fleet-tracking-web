import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectFocusVisible,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectTouchTargets,
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
    if (isMobile(page)) await expectTouchTargets(page);
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
    await expectNoAxeViolations(page);
    if (isMobile(page)) await expectTouchTargets(page);
    await captureForReview(page, "01-shell-user-menu");

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await page.getByRole("button", { name: "Account menu for Demo Dispatcher" }).click();
    await menu.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  });

  test("the reconnecting banner never covers the user menu", async ({ page }) => {
    await page.routeWebSocket(/\/api\/v1\/live\/ws$/, (socket) => {
      void socket.close();
    });

    await page.goto("/map");
    await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
    const banner = page
      .getByRole("status")
      .filter({ hasText: "Reconnecting to live updates…" });
    await expect(banner).toHaveText("Reconnecting to live updates…", { timeout: 20_000 });

    await page.getByRole("button", { name: "Account menu for Demo Dispatcher" }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByText("Demo Dispatcher")).toBeVisible();
    await expect(menu.getByText("dispatcher@demo.ftb")).toBeVisible();

    const layering = await page.evaluate(() => {
      const bannerElement = document.querySelector(".z-banner");
      const menuElement = document.querySelector('[role="menu"]');
      if (!bannerElement || !menuElement) return null;
      const bannerBox = bannerElement.getBoundingClientRect();
      const menuBox = menuElement.getBoundingClientRect();
      const overlaps =
        bannerBox.left < menuBox.right &&
        bannerBox.right > menuBox.left &&
        bannerBox.top < menuBox.bottom &&
        bannerBox.bottom > menuBox.top;
      const point = {
        x: menuBox.left + menuBox.width / 2,
        y: Math.max(menuBox.top, bannerBox.top) + 4,
      };
      const hit = document.elementFromPoint(point.x, point.y);
      return {
        overlaps,
        menuOnTop: hit !== null && menuElement.contains(hit),
        inViewport:
          menuBox.left >= 0 &&
          menuBox.top >= 0 &&
          menuBox.right <= window.innerWidth &&
          menuBox.bottom <= window.innerHeight,
        bannerZ: Number(getComputedStyle(bannerElement).zIndex),
        menuZ: Number(getComputedStyle(menuElement).zIndex),
      };
    });

    expect(layering).not.toBeNull();
    expect(layering?.overlaps, "the menu must overlap the banner area").toBe(true);
    expect(layering?.menuOnTop, "the banner must paint behind the menu").toBe(true);
    expect(layering?.inViewport, "the menu must be fully inside the viewport").toBe(true);
    expect(layering?.bannerZ).toBeLessThan(layering?.menuZ ?? 0);

    await captureForReview(page, "01-shell-banner-menu");
  });

  test("the appearance section switches the resolved theme", async ({ page }) => {
    await page.goto("/map");

    await page.getByRole("button", { name: "Account menu for Demo Dispatcher" }).click();
    const appearance = page.getByRole("group", { name: "Appearance" });
    const dark = appearance.getByRole("menuitemradio", { name: "Dark" });
    await dark.focus();
    await expectNoAxeViolations(page);
    if (isMobile(page)) await expectTouchTargets(page);
    await page.keyboard.press("Enter");

    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("dark");
    await expect(page.getByRole("menu")).toBeVisible();
    await captureForReview(page, "01-shell-appearance");
  });

  test("the accent persists and the top bar has no theme control", async ({ page }) => {
    await page.goto("/map");
    const header = page.locator("header").first();
    await expect(header.getByRole("group", { name: "Colour theme" })).toHaveCount(0);

    await page.getByRole("button", { name: "Account menu for Demo Dispatcher" }).click();
    await page
      .getByRole("group", { name: "Appearance" })
      .getByRole("menuitemradio", { name: "Graphite accent" })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-accent", "graphite");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-accent", "graphite");
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
    await expect.poll(() => page.title()).toContain("Alerts · Fleet Console");
    await expect(page.getByRole("dialog", { name: "Navigation" })).toHaveCount(0);
  });

  test("escape clears the map search query", async ({ page }) => {
    await page.goto("/map?q=KJA");
    await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(/\/map$/);
  });

  test("a failed sign out still leaves the device and says so", async ({ page }) => {
    await page.goto("/map?fault=logout:network");
    await page.getByRole("button", { name: "Account menu for Demo Dispatcher" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Signed out on this device", { exact: true })).toBeVisible();
    await expect(
      page.getByText("The server couldn't be reached, so your session may still be active there.", {
        exact: true,
      }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("keyboard shortcuts focus search, navigate and open the dialog", async ({ page }) => {
    await page.goto("/map");
    await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
    await page.keyboard.press("/");
    const search = page.getByRole("searchbox", { name: "Search vehicles" }).first();
    await expect(search).toBeFocused();
    await expectFocusVisible(search);

    await page.locator("main").focus();
    await page.keyboard.press("g");
    await page.keyboard.press("a");
    await expect(page).toHaveURL(/\/alerts$/);

    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await expect(page.getByText("Focus vehicle search")).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "01-shell-shortcuts");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toHaveCount(0);
  });

  test("shortcuts do not fire while typing in the search field", async ({ page }) => {
    await page.goto("/map");
    if (isMobile(page)) {
      await page.getByRole("button", { name: "Search vehicles" }).click();
    }
    const search = page.getByRole("searchbox", { name: "Search vehicles" }).first();
    await search.click();
    await search.pressSequentially("?ga");

    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toHaveCount(0);
    await expect(page).toHaveURL(/\/map$/);
    await expect(search).toHaveValue("?ga");
  });

  test("a 401 mid-session opens the blocking expiry dialog and resumes", async ({ page }) => {
    await page.goto("/map");
    await page.goto("/dev/faults");
    await expect(page.getByRole("heading", { name: "Fault lab" })).toBeVisible();
    await page.evaluate(() =>
      history.replaceState({}, "", "/dev/faults?fault=alerts:unauthenticated"),
    );
    await page.getByRole("button", { name: "Refetch alerts" }).click();

    const dialog = page.getByRole("dialog", { name: "Your session expired" });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText("You'll stay where you are.");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "01-shell-session-expired");

    await page.evaluate(() => history.replaceState({}, "", "/dev/faults"));
    await page.getByLabel("Email", { exact: true }).fill("dispatcher@demo.ftb");
    await page.getByLabel("Password", { exact: true }).fill("DemoPass123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(dialog).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Fault lab" })).toBeVisible();
  });

  test("offline shows the global banner with a disabled-change warning", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    });
    await page.goto("/map");

    await expect(page.getByText(/You're offline/)).toBeVisible();
    await expect(page.getByText(/Changes are disabled/)).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "01-shell-offline-banner");
  });

  test("an update announcement shows the reload banner", async ({ page }) => {
    await page.goto("/map");
    await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("fleet:update-available")));

    await expect(page.getByText("A new version is available.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "01-shell-update-banner");
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
    if (isMobile(page)) await expectTouchTargets(page);
    await captureForReview(page, "01-shell-forbidden");
  });
});

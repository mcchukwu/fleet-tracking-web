import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectLockedDocument,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectPageFrame,
} from "./helpers";

/**
 * The frame contract: one frame per route, a document that never scrolls, a
 * top bar that never moves, and exactly one bottom inset at the end of a
 * scrolling page. Measurements only; this suite runs in every viewport and
 * theme the product supports.
 */

type FrameLayout = "fill" | "scroll";

interface RouteCase {
  path: string;
  layout: FrameLayout;
  heading: string;
  map?: boolean;
  /** Routes outside the app shell have no top bar. */
  shell?: boolean;
}

const ROUTES: readonly RouteCase[] = [
  {
    path: "/map?map=fake",
    layout: "fill",
    heading: "Map",
    map: true,
    shell: true,
  },
  {
    path: "/geofences?map=fake",
    layout: "fill",
    heading: "Geofences",
    map: true,
    shell: true,
  },
  { path: "/playback", layout: "fill", heading: "Playback", shell: true },
  { path: "/alerts", layout: "fill", heading: "Alerts", shell: true },
  { path: "/trips", layout: "fill", heading: "Trips", shell: true },
  { path: "/drivers", layout: "fill", heading: "Drivers", shell: true },
  { path: "/audit", layout: "fill", heading: "Audit", shell: true },
  { path: "/reports", layout: "scroll", heading: "Reports", shell: true },
  { path: "/system", layout: "scroll", heading: "System health", shell: true },
  { path: "/import", layout: "scroll", heading: "Import", shell: true },
  {
    path: "/styleguide",
    layout: "scroll",
    heading: "Fleet Console foundations",
    shell: true,
  },
  { path: "/forbidden", layout: "scroll", heading: "Forbidden", shell: true },
  { path: "/no-such-route", layout: "scroll", heading: "Page not found" },
  { path: "/dev/faults", layout: "scroll", heading: "Fault lab", shell: true },
  {
    path: "/dev/layers",
    layout: "scroll",
    heading: "Layer stack",
    shell: true,
  },
  {
    path: "/dev/combobox",
    layout: "scroll",
    heading: "Combobox lab",
    shell: true,
  },
];

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 412, height: 915 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
] as const;

test.describe.configure({ timeout: 300_000 });

async function useAdmin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("fleet.mockRole", "admin");
  });
}

async function gotoRoute(page: Page, route: RouteCase): Promise<void> {
  await page.goto(route.path);
  await expect(
    page.getByRole("heading", { name: route.heading, level: 1 }),
  ).toBeVisible({ timeout: 30_000 });
  if (route.map) {
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), {
        timeout: 30_000,
      })
      .toBe(true);
  }
}

interface FrameMeasurement {
  frameHeight: number;
  frameBottom: number;
  contentPaddingBottom: number;
  contentHeight: number;
  overflow: number;
  scrollHeight: number;
  clientHeight: number;
  lowestContentBottom: number;
}

async function measureFrame(page: Page): Promise<FrameMeasurement> {
  return page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>("[data-page-frame]");
    const content = frame?.querySelector<HTMLElement>(
      "[data-page-frame-content]",
    );
    if (!frame || !content) throw new Error("The page frame is missing");
    const contentBox = content.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    // The last in-flow block defines where the content ends; descendants of a
    // closed <details> still report boxes but are not part of the page.
    const last = content.lastElementChild;
    const lowestContentBottom = last
      ? last.getBoundingClientRect().bottom
      : contentBox.bottom;
    return {
      frameHeight: frameBox.height,
      frameBottom: frameBox.bottom,
      contentPaddingBottom:
        Number.parseFloat(window.getComputedStyle(content).paddingBottom) || 0,
      contentHeight: contentBox.height,
      overflow: frame.scrollHeight - frame.clientHeight,
      scrollHeight: frame.scrollHeight,
      clientHeight: frame.clientHeight,
      lowestContentBottom,
    };
  });
}

async function scrollEverything(page: Page): Promise<void> {
  await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>("[data-page-frame]");
    if (!frame) return;
    for (const element of [
      frame,
      ...frame.querySelectorAll<HTMLElement>("*"),
    ]) {
      if (element.scrollHeight > element.clientHeight + 1) {
        element.scrollTop = element.scrollHeight;
      }
    }
  });
}

test.describe("page frames", { tag: "@theme" }, () => {
  for (const viewport of VIEWPORTS) {
    test(`every route declares one frame and locks the document at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await useAdmin(page);
      await page.setViewportSize(viewport);

      for (const route of ROUTES) {
        await gotoRoute(page, route);
        const frame = await expectPageFrame(page, route.layout);
        await expectLockedDocument(page);
        await expectNoHorizontalScroll(page);

        const measured = await measureFrame(page);
        if (route.layout === "fill") {
          expect(
            measured.overflow,
            `${route.path} at ${viewport.width}x${viewport.height} scrolls the frame`,
          ).toBeLessThanOrEqual(1);
          expect(
            measured.contentHeight,
            `${route.path} content extends below the frame`,
          ).toBeLessThanOrEqual(measured.frameHeight + 1);
        }

        if (route.shell) {
          const bar = page.locator("header").first();
          const before = await bar.boundingBox();
          await scrollEverything(page);
          const after = await bar.boundingBox();
          expect(before, `${route.path} has no top bar`).not.toBeNull();
          expect(after, `${route.path} lost its top bar`).not.toBeNull();
          if (before && after) {
            expect(
              Math.abs(after.y - before.y),
              `${route.path} top bar moved vertically`,
            ).toBeLessThanOrEqual(1);
            expect(
              Math.abs(after.height - before.height),
              `${route.path} top bar changed height`,
            ).toBeLessThanOrEqual(1);
          }
        }
        await frame.evaluate((element) => {
          element.scrollTop = 0;
        });
      }
    });

    test(`scrolling pages end at exactly one bottom inset at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await useAdmin(page);
      await page.setViewportSize(viewport);

      for (const route of ROUTES.filter((item) => item.layout === "scroll")) {
        await gotoRoute(page, route);
        const frame = await expectPageFrame(page, "scroll");
        await frame.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });

        const measured = await measureFrame(page);
        if (measured.scrollHeight <= measured.clientHeight + 1) continue;

        const gap = measured.frameBottom - measured.lowestContentBottom;
        expect(
          Math.abs(gap - measured.contentPaddingBottom),
          `${route.path} at ${viewport.width}x${viewport.height}: content ends ${gap}px above the frame instead of ${measured.contentPaddingBottom}px`,
        ).toBeLessThanOrEqual(1);
        expect(
          measured.contentPaddingBottom,
          `${route.path} is missing the page bottom inset`,
        ).toBeGreaterThanOrEqual(24);
      }
    });
  }

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
  ] as const) {
    test(`the alerts no-results recovery scrolls inside the fill frame at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await useAdmin(page);
      await page.setViewportSize(viewport);
      await page.goto("/alerts?map=fake&q=zzzz");
      await expect(
        page.getByRole("heading", { name: "Alerts", level: 1 }),
      ).toBeVisible({ timeout: 30_000 });
      const frame = await expectPageFrame(page, "fill");
      await expect(page.getByText("No alerts match")).toBeVisible();

      const overflow = await frame.evaluate(
        (element) => element.scrollHeight - element.clientHeight,
      );
      expect(
        overflow,
        "the alerts frame clips its empty state",
      ).toBeLessThanOrEqual(1);

      const body = page.getByTestId("alerts-table-body");
      const metrics = await body.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: window.getComputedStyle(element).overflowY,
      }));
      expect(metrics.overflowY).toBe("auto");
      expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

      const clear = page.getByRole("button", { name: "Clear filters" });
      await body.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect(clear).toBeInViewport();
      await captureForReview(page, "13b-alerts-no-results");
      await clear.click();
      await expect(page).toHaveURL((url) => !url.searchParams.has("q"));
    });
  }

  test("the alerts loading skeleton scrolls inside the fill frame at 320x568", async ({
    page,
  }) => {
    await useAdmin(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/alerts?map=fake&fault=alerts%3Aslow");
    await expect(page.getByLabel("Loading alerts")).toBeVisible({
      timeout: 30_000,
    });
    const frame = await expectPageFrame(page, "fill");
    const overflow = await frame.evaluate(
      (element) => element.scrollHeight - element.clientHeight,
    );
    expect(
      overflow,
      "the alerts frame clips its loading skeleton",
    ).toBeLessThanOrEqual(1);
    const body = page.getByTestId("alerts-table-body");
    const metrics = await body.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    await captureForReview(page, "13b-alerts-loading");
  });

  test("a collapsing mobile toolbar leaves no gap", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoRoute(page, ROUTES[3] ?? ROUTES[0]);
    await page.setViewportSize({ width: 390, height: 780 });

    const measured = await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>("[data-page-frame]");
      return {
        innerHeight: window.innerHeight,
        rootHeight: document.documentElement.scrollHeight,
        frameBottom: frame?.getBoundingClientRect().bottom ?? 0,
      };
    });
    expect(measured.innerHeight).toBe(780);
    expect(measured.rootHeight).toBeLessThanOrEqual(781);
    expect(Math.abs(measured.frameBottom - 780)).toBeLessThanOrEqual(1);
    await expectLockedDocument(page);
  });

  test("the viewport meta opts into the safe area", async ({ page }) => {
    await page.goto("/styleguide");
    const content = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");
    expect(content).toContain("viewport-fit=cover");
    await expectPageFrame(page, "scroll");
    await expectLockedDocument(page);
  });

  test("representative routes are axe clean inside their frames", async ({
    page,
  }) => {
    await useAdmin(page);
    for (const path of [
      "/map?map=fake",
      "/alerts",
      "/reports",
      "/styleguide",
      "/no-such-route",
    ]) {
      await page.goto(path);
      await expect(page.locator("[data-page-frame]")).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator("[data-page-frame]")).toHaveCount(1);
      await expectNoAxeViolations(page);
    }
    await captureForReview(page, "13b-page-frames-not-found");
  });

  test("sign in is a centred scroll frame", async ({ page }) => {
    await page.goto("/styleguide");
    await page.evaluate(() =>
      localStorage.setItem("fleet.mockAuth", "anonymous"),
    );
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Sign in", level: 1 }),
    ).toBeVisible();
    const frame = await expectPageFrame(page, "scroll");
    await expectLockedDocument(page);
    const centred = await page.evaluate(() => {
      const main = document.querySelector("main");
      const content = document.querySelector("[data-page-frame-content]");
      if (!main || !content) return 0;
      const mainBox = main.getBoundingClientRect();
      const contentBox = content.getBoundingClientRect();
      return Math.abs(
        (mainBox.top + mainBox.bottom) / 2 -
          (contentBox.top + contentBox.bottom) / 2,
      );
    });
    expect(centred).toBeLessThanOrEqual(1);
    await frame.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expectNoAxeViolations(page);
    await captureForReview(page, "13b-page-frames-login");
  });
});

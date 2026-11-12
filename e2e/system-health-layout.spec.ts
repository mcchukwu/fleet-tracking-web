import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectTabularNums,
  expectTouchTargets,
} from "./helpers";

async function setScenario(page: Page, scenario: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockSystem", value);
  }, scenario);
}

async function gotoReady(page: Page): Promise<void> {
  await page.goto("/system");
  await expect(page.getByText("All systems healthy")).toBeVisible({
    timeout: 15_000,
  });
}

function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 1024;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function boxes(page: Page, group: string): Promise<Box[]> {
  return page
    .locator(`[data-health-group="${group}"] [data-health-item]`)
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }),
    );
}

test.describe("system health layout", () => {
  test("the three groups keep their columns and never overflow", { tag: "@theme" }, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoReady(page);
    await expectNoHorizontalScroll(page);

    if (isMobile(page)) {
      for (const [group, count] of [
        ["dependencies", 2],
        ["fleet", 4],
        ["ingest", 8],
      ] as const) {
        const items = await boxes(page, group);
        expect(items).toHaveLength(count);
        expect(new Set(items.map((box) => box.width)).size).toBe(1);
        for (let index = 1; index < items.length; index += 1) {
          expect(items[index]?.y).toBeGreaterThan(items[index - 1]?.y ?? 0);
        }
      }
    } else {
      const dependencies = await boxes(page, "dependencies");
      expect(dependencies).toHaveLength(2);
      expect(new Set(dependencies.map((box) => box.y)).size).toBe(1);

      const fleet = await boxes(page, "fleet");
      expect(fleet).toHaveLength(4);
      expect(new Set(fleet.map((box) => box.y)).size).toBe(1);

      const ingest = await boxes(page, "ingest");
      expect(ingest).toHaveLength(8);
      expect(ingest[0]?.y).toBe(ingest[3]?.y);
      expect(ingest[4]?.y).toBe(ingest[7]?.y);
      expect(ingest[4]?.y).toBeGreaterThan(ingest[0]?.y ?? 0);
      expect(new Set(ingest.map((box) => box.width)).size).toBe(1);
    }

    const values = page.locator("[data-health-item] .tabular-nums");
    const count = await values.count();
    expect(count).toBeGreaterThanOrEqual(14);
    for (let index = 0; index < count; index += 1) {
      await expectTabularNums(values.nth(index));
    }
    await expectTabularNums(page.locator("[data-health-updated] time"));
    await expectNoAxeViolations(page);
    await captureForReview(page, "11-system-healthy");
  });

  test("values never wrap or clip at 390 and 360", { tag: "@theme" }, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page);

    const values = page.locator("[data-health-item] .tabular-nums");
    const count = await values.count();
    for (let index = 0; index < count; index += 1) {
      const clipped = await values.nth(index).evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }));
      expect(clipped.scrollWidth).toBeLessThanOrEqual(clipped.clientWidth);
    }

    await page.setViewportSize({ width: 360, height: 640 });
    await expectNoHorizontalScroll(page);
    const groups = await page.locator("[data-health-group]").count();
    expect(groups).toBe(3);
    await expectTouchTargets(page, 44);
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "11-system-healthy-360");
  });

  test("a degraded report still fits and marks the problem first", { tag: "@theme" }, async ({
    page,
  }) => {
    await setScenario(page, "dependency-down");
    await page.goto("/system");
    await expect(page.getByText("1 issue needs attention")).toBeVisible({
      timeout: 15_000,
    });
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "11-system-degraded");
  });

  test("the error state keeps its heading and is accessible", { tag: "@theme" }, async ({
    page,
  }) => {
    await page.goto(`/system?fault=${encodeURIComponent("system-health:server")}`);
    await expect(page.getByText("Can't reach the API")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "System health", level: 1 }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "11-system-error");
  });

  test("the stale report keeps its values and its label", { tag: "@theme" }, async ({
    page,
    context,
  }) => {
    await gotoReady(page);
    await context.setOffline(true);
    await expect(page.getByText(/Stale ·/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("20 of 25")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "11-system-stale");
    await context.setOffline(false);
  });
});

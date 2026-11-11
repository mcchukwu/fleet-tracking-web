import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectStableColumns,
  expectTabularNums,
  expectTouchTargets,
} from "./helpers";

const FROM = "2026-11-01T00:00:00Z";
const TO = "2026-11-08T00:00:00Z";

function rangeUrl(): string {
  return `/reports?from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`;
}

function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 1024;
}

async function setScenario(page: Page, scenario: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockReports", value);
  }, scenario);
}

async function gotoReports(page: Page, search = rangeUrl()): Promise<void> {
  await page.goto(search);
  await expect(page.getByTestId("reports-stats")).toBeVisible({ timeout: 15_000 });
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function statBoxes(page: Page): Promise<Box[]> {
  return page.locator("[data-stat-id]").evaluateAll((elements) =>
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

test.describe("reports layout", () => {
  test("the seven stats hold one row or a two-column grid", { tag: "@theme" }, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoReports(page);
    await expectNoHorizontalScroll(page);

    const boxes = await statBoxes(page);
    expect(boxes).toHaveLength(7);
    for (const box of boxes) {
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    if (isMobile(page)) {
      expect(boxes[0]?.width).toBe(boxes[1]?.width);
      expect(boxes[0]?.y).toBe(boxes[1]?.y);
      expect(boxes[2]?.y).toBeGreaterThan(boxes[0]?.y ?? 0);
    } else {
      expect(new Set(boxes.map((box) => box.y)).size).toBe(1);
    }

    await expectTabularNums(
      page.getByTestId("reports-stats").locator(".tabular-nums").first(),
    );
    await expectNoAxeViolations(page);
    await captureForReview(page, "10-reports-default");

    await page.getByText("View data table").click();
    const table = page.getByTestId("alerts-by-type").locator("[data-data-table]");
    await expectStableColumns(table, 36);
    await expectNoHorizontalScroll(page);
    await expectTabularNums(
      page.getByTestId("alerts-by-type").locator('td[data-column-id="count"]').first(),
    );
    await expectNoAxeViolations(page);
  });

  test("the large report keeps every stat on one line and the strip even", async ({
    page,
  }) => {
    await setScenario(page, "large");
    await gotoReports(page);

    const boxes = await statBoxes(page);
    expect(new Set(boxes.map((box) => box.height)).size).toBe(1);
    const value = page.locator('[data-stat-id="distance"] .tabular-nums');
    const clipped = await value.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(clipped.scrollWidth).toBeLessThanOrEqual(clipped.clientWidth);
    await expectNoHorizontalScroll(page);
  });

  test("the chart skeleton matches the ready card", async ({ page }) => {
    await page.goto(`${rangeUrl()}&fault=${encodeURIComponent("reports:slow")}`);
    const skeleton = page.getByTestId("reports-skeleton-chart");
    await expect(skeleton).toBeVisible({ timeout: 15_000 });
    const skeletonBox = await skeleton.boundingBox();

    await page.goto(rangeUrl());
    await expect(page.getByTestId("alerts-by-type")).toBeVisible({ timeout: 15_000 });
    const readyBox = await page.getByTestId("alerts-by-type").boundingBox();
    if (!skeletonBox || !readyBox) throw new Error("The chart has no box");
    expect(Math.abs(skeletonBox.height - readyBox.height)).toBeLessThanOrEqual(1);
  });

  test("the seven-digit chart value stays inside its column", async ({ page }) => {
    await setScenario(page, "huge");
    await page.setViewportSize({ width: 390, height: page.viewportSize()?.height ?? 844 });
    await gotoReports(page);

    const value = page.getByTestId("alerts-by-type").locator("span.tabular-nums").first();
    const clipped = await value.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(clipped.scrollWidth).toBeLessThanOrEqual(clipped.clientWidth);
    await expectNoHorizontalScroll(page);
  });

  test("chart labels truncate instead of pushing the page at 360px", { tag: "@theme" }, async ({
    page,
  }) => {
    test.skip(!isMobile(page), "mobile-only layout");
    await page.setViewportSize({ width: 360, height: 640 });
    await setScenario(page, "large");
    await gotoReports(page);

    const label = page.getByTestId("chart-label").filter({ hasText: "Unknown type" });
    await expect(label).toHaveAttribute("title", "Unknown type: solar_flare");
    const clipped = await label.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(clipped.scrollWidth).toBeGreaterThan(clipped.clientWidth);
    await expectNoHorizontalScroll(page);

    const card = await page.getByTestId("alerts-by-type").boundingBox();
    const value = await page
      .getByTestId("alerts-by-type")
      .locator(".tabular-nums")
      .first()
      .boundingBox();
    if (!card || !value) throw new Error("The chart has no box");
    expect(value.x + value.width).toBeLessThanOrEqual(card.x + card.width);
    await captureForReview(page, "10-reports-layout-360");
  });

  test("every control keeps a 44px target and the custom dialog fits", { tag: "@theme" }, async ({
    page,
  }) => {
    test.skip(!isMobile(page), "touch targets are a mobile concern");
    await gotoReports(page);
    await expectTouchTargets(page, 44);

    await page.getByRole("button", { name: /^Range, / }).click();
    await page.getByRole("menuitem", { name: "Custom range…" }).click();
    const dialog = page.getByRole("dialog", { name: "Report range" });
    await expect(dialog).toBeVisible();
    await expectTouchTargets(page, 44);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: /^Range, / })).toBeFocused();
  });

  test("the zero report reads as a zero, not a failure", { tag: "@theme" }, async ({ page }) => {
    await setScenario(page, "zero");
    await gotoReports(page);
    await expect(page.getByText("No alerts in this range")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "10-reports-zero");
  });

  test("the error state is clear and keeps the range control", { tag: "@theme" }, async ({
    page,
  }) => {
    await page.goto(`${rangeUrl()}&fault=${encodeURIComponent("reports:server")}`);
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /^Range, / })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "10-reports-error");
  });

  test("the stale report keeps its values and its label", { tag: "@theme" }, async ({
    page,
    context,
  }) => {
    await gotoReports(page);
    await context.setOffline(true);
    await expect(page.getByText(/Stale ·/)).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "10-reports-stale");
    await context.setOffline(false);
  });
});

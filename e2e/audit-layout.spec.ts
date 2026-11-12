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

const COLUMN_WIDTHS = [128, 160, 200, 110, 300, 280];

async function setRole(page: Page, role = "admin"): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockRole", value);
  }, role);
}

async function gotoAudit(page: Page, search = ""): Promise<void> {
  await page.goto(`/audit${search ? `?${search}` : ""}`);
  await expect(
    page.getByRole("heading", { name: "Audit", level: 1 }),
  ).toBeVisible({ timeout: 15_000 });
}

async function waitForTable(page: Page): Promise<void> {
  await expect(page.getByRole("columnheader", { name: "Actor" })).toBeVisible({
    timeout: 15_000,
  });
}

function table(page: Page) {
  return page.locator('[data-testid="audit-page"] [data-data-table]');
}

async function openDetail(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /Open audit entry: Import vehicles/i })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Audit entry details" }),
  ).toBeVisible();
}

test.describe("audit layout", { tag: "@theme" }, () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await setRole(page);
  });

  test("keeps six fixed columns, 36px rows and a sticky header", async ({ page }) => {
    await gotoAudit(page);
    await waitForTable(page);

    const geometry = await table(page).evaluate((root) => {
      const element = root.querySelector<HTMLTableElement>("table");
      const scroller = root.querySelector<HTMLElement>(
        "[data-data-table-scroll]",
      );
      if (!element || !scroller) throw new Error("The audit table did not render");
      return {
        layout: window.getComputedStyle(element).tableLayout,
        minWidth: Number.parseFloat(window.getComputedStyle(element).minWidth),
        declaredWidths: [
          ...element.querySelectorAll<HTMLTableColElement>("col"),
        ].map((col) => Number.parseFloat(col.style.width)),
        headerAlign: [
          ...element.querySelectorAll<HTMLTableCellElement>("thead th"),
        ].map((header) => window.getComputedStyle(header).textAlign),
        rows: [
          ...element.querySelectorAll<HTMLTableRowElement>(
            'tbody tr[data-row="data"]',
          ),
        ]
          .slice(0, 3)
          .map((row) => Math.round(row.getBoundingClientRect().height)),
        scrollWidth: scroller.scrollWidth,
        clientWidth: scroller.clientWidth,
      };
    });

    expect(geometry.layout).toBe("fixed");
    expect(geometry.declaredWidths).toEqual(COLUMN_WIDTHS);
    expect(geometry.minWidth).toBe(COLUMN_WIDTHS.reduce((a, b) => a + b, 0));
    expect(geometry.headerAlign.every((align) => align === "left")).toBe(true);
    expect(geometry.rows).toEqual([36, 36, 36]);

    await expectStableColumns(table(page));
    await expectTabularNums(
      page.locator('[data-column-id="time"] [data-cell-content] time').first(),
    );
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-list");
  });

  test("stacks the filters and scrolls only the table on a narrow page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAudit(page);
    await waitForTable(page);

    const action = await page.getByLabel("Action").boundingBox();
    const search = await page.getByLabel("Search audit log").boundingBox();
    expect(action, "the action select has no box").not.toBeNull();
    expect(search, "the search field has no box").not.toBeNull();
    if (action && search) {
      expect(search.y, "the search does not sit under the select").toBeGreaterThanOrEqual(
        action.y + action.height - 1,
      );
      expect(Math.abs(search.x - action.x)).toBeLessThanOrEqual(1);
    }

    const scroll = await table(page)
      .locator("[data-data-table-scroll]")
      .evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }));
    expect(scroll.scrollWidth, "the table does not scroll horizontally").toBeGreaterThan(
      scroll.clientWidth,
    );

    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-list");
  });

  test("the detail is a top-quarter sheet on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAudit(page);
    await waitForTable(page);
    await openDetail(page);

    const drawer = page.locator('[data-placement="page"]');
    const box = await drawer.boundingBox();
    const content = await page.getByTestId("content-area").boundingBox();
    expect(box).not.toBeNull();
    expect(content).not.toBeNull();
    if (box && content) {
      const expected = content.y + content.height * 0.25;
      expect(box.y).toBeGreaterThanOrEqual(expected - 2);
      expect(box.y).toBeLessThanOrEqual(expected + 2);
      expect(box.x).toBe(0);
    }
    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-detail");
  });

  test("holds the layout at 360x640", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await gotoAudit(page);
    await waitForTable(page);

    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page);
    const rows = await page
      .locator('tbody tr[data-row="data"]')
      .first()
      .evaluate((element) => Math.round(element.getBoundingClientRect().height));
    expect(rows).toBe(36);
    await captureForReview(page, "12-audit-layout-360");
  });

  test("captures and axe-checks the empty, no-results, error, stale and forbidden states", async ({
    page,
  }) => {
    await gotoAudit(page, "empty=audit");
    await expect(page.getByText("No audit entries yet")).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-empty");

    await gotoAudit(page, "q=zzzz-nothing");
    await expect(page.getByText("No entries match")).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-no-results");

    await page.goto("/audit?fault=audit%3Aserver");
    await expect(page.getByText("Something went wrong on our side")).toBeVisible({
      timeout: 15_000,
    });
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-error");

    await page.goto("/audit?fault=audit%3Aforbidden");
    await expect(page.getByText("You don't have access to this.")).toBeVisible();
    await expectNoAxeViolations(page);

    await page.goto("/audit");
    await expect(page.getByTestId("audit-page")).toContainText("12 entries loaded");
    await page.context().setOffline(true);
    await expect(page.getByText(/Stale ·/)).toBeVisible({ timeout: 15_000 });
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-stale");
    await page.context().setOffline(false);
  });

  test("the drawer passes axe in this theme", async ({ page }) => {
    await gotoAudit(page);
    await waitForTable(page);
    await openDetail(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-detail");
  });
});

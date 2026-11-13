import type { Page } from "@playwright/test";
import { expect, test, type LiveSocketHarness } from "./fixtures";
import { captureForReview, expectNoHorizontalScroll, expectStableColumns } from "./helpers";

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
] as const;
const SEED = 200;

async function openAlerts(page: Page): Promise<void> {
  await page.goto("/alerts?map=fake");
  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Plate" })).toBeVisible();
}

async function seedAlerts(page: Page, liveSocket: LiveSocketHarness): Promise<void> {
  await page.evaluate(async (count) => {
    await fetch("/api/v1/__mock/alerts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
  }, SEED);
  const socket = await liveSocket.wait();
  socket.send(
    JSON.stringify({
      type: "alert",
      tenant_id: "tenant-demo",
      vehicle_id: "demo-imei-0001",
      severity: "high",
      occurred_at: new Date().toISOString(),
    }),
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const text = document.querySelector('[data-testid="alerts-page"]')?.textContent ?? "";
          const match = text.match(/(\d+) loaded/);
          return match ? Number(match[1]) : 0;
        }),
      { timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(SEED);
  await page.locator('[data-row="data"]').first().waitFor();
}

async function tableGeometry(page: Page) {
  return page.locator("[data-data-table]").evaluate((root) => {
    const table = root.querySelector<HTMLTableElement>("table");
    const scroller = root.querySelector<HTMLElement>("[data-data-table-scroll]");
    if (!table || !scroller) throw new Error("The data table did not render");
    const row = table.querySelector<HTMLTableRowElement>('tbody tr[data-row="data"]');
    const headers = [...table.querySelectorAll<HTMLTableCellElement>("thead th")];
    const cells = row ? [...row.querySelectorAll<HTMLTableCellElement>("td")] : [];
    const badge = table.querySelector<HTMLElement>(
      'tbody tr[data-row="data"] td[data-column-id="status"] [data-cell-content] > span > span:first-child',
    );
    const statusCell = badge?.closest<HTMLTableCellElement>("td") ?? null;
    const badgeRect = badge?.getBoundingClientRect();
    const statusRect = statusCell?.getBoundingClientRect();
    return {
      layout: window.getComputedStyle(table).tableLayout,
      minWidth: Number.parseFloat(window.getComputedStyle(table).minWidth),
      declaredWidths: [...table.querySelectorAll<HTMLTableColElement>("col")].map((col) =>
        Number.parseFloat(col.style.width),
      ),
      scrollWidth: scroller.scrollWidth,
      clientWidth: scroller.clientWidth,
      headers: headers.map((header) => ({
        id: header.dataset.columnId,
        align: window.getComputedStyle(header).textAlign,
      })),
      cells: cells.map((cell) => {
        const content = cell.querySelector<HTMLElement>("[data-cell-content]");
        const style = content ? window.getComputedStyle(content) : null;
        return {
          id: cell.dataset.columnId,
          align: window.getComputedStyle(cell).textAlign,
          paddingLeft: Number.parseFloat(window.getComputedStyle(cell).paddingLeft),
          paddingRight: Number.parseFloat(window.getComputedStyle(cell).paddingRight),
          whiteSpace: style?.whiteSpace ?? "",
          truncated: content !== null && content.scrollWidth > content.clientWidth + 1,
        };
      }),
      rowHeights: [...table.querySelectorAll<HTMLTableRowElement>('tbody tr[data-row="data"]')].map(
        (rowElement) => rowElement.getBoundingClientRect().height,
      ),
      badgeInsetLeft: badgeRect && statusRect ? badgeRect.left - statusRect.left : null,
      badgeInsetRight: badgeRect && statusRect ? statusRect.right - badgeRect.right : null,
    };
  });
}

test.describe("alerts table layout", { tag: "@theme" }, () => {
  test("keeps a full plate and trip id whole", async ({ page }) => {
    await openAlerts(page);
    await page.getByLabel("Search plate").fill("LSD-101-AA");
    await expect(page.getByLabel("Copy plate LSD-101-AA").first()).toBeVisible();

    const trip = page
      .locator('[data-column-id="trip"] [data-cell-content]')
      .filter({ hasText: /[0-9a-f]{8}-/ })
      .first();
    await expect(trip).toBeVisible();
    const overflow = await trip.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow, "a trip id must never truncate").toBeLessThanOrEqual(1);

    const plate = page.locator('[data-column-id="plate"] [data-cell-content]').first();
    const plateOverflow = await plate.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    );
    expect(plateOverflow, "a plate must never truncate").toBeLessThanOrEqual(1);
    await captureForReview(page, "04-alerts-table-whole-values");
  });

  test("keeps the acknowledged badge and its time on one line", async ({ page }) => {
    await openAlerts(page);
    await page.getByLabel("Status").selectOption("acked");
    const cell = page.locator('tbody tr[data-row="data"] td[data-column-id="status"]').first();
    await expect(cell).toBeVisible();

    const line = await cell.evaluate((element) => {
      const content = element.querySelector<HTMLElement>("[data-cell-content]");
      const wrapper = element.querySelector<HTMLElement>("[data-cell-content] > span");
      const badge = element.querySelector<HTMLElement>(
        "[data-cell-content] > span > span:first-child > span",
      );
      const time = element.querySelector<HTMLElement>(
        "[data-cell-content] > span > span:last-child",
      );
      if (!content || !wrapper || !badge || !time)
        throw new Error("The status cell has no badge and time");
      const badgeRect = badge.getBoundingClientRect();
      const timeRect = time.getBoundingClientRect();
      const cellRect = element.getBoundingClientRect();
      const wrapperStyle = window.getComputedStyle(wrapper);
      const badgeStyle = window.getComputedStyle(badge);
      const timeStyle = window.getComputedStyle(time);
      return {
        badgeCenter: badgeRect.top + badgeRect.height / 2,
        badgeRight: badgeRect.right,
        timeCenter: timeRect.top + timeRect.height / 2,
        timeLeft: timeRect.left,
        contentHeight: timeRect.bottom - badgeRect.top,
        cellHeight: cellRect.height,
        contentScrollWidth: content.scrollWidth,
        contentClientWidth: content.clientWidth,
        display: wrapperStyle.display,
        flexWrap: wrapperStyle.flexWrap,
        whiteSpace: wrapperStyle.whiteSpace,
        badgeWhiteSpace: badgeStyle.whiteSpace,
        timeWhiteSpace: timeStyle.whiteSpace,
      };
    });

    expect(Math.abs(line.badgeCenter - line.timeCenter)).toBeLessThanOrEqual(2);
    expect(line.timeLeft).toBeGreaterThanOrEqual(line.badgeRight - 1);
    expect(line.contentHeight).toBeLessThanOrEqual(24);
    expect(line.cellHeight).toBeLessThanOrEqual(37);
    expect(line.contentScrollWidth).toBeLessThanOrEqual(line.contentClientWidth + 1);
    expect(line.display).toContain("flex");
    expect(line.flexWrap).toBe("nowrap");
    expect(line.whiteSpace).toBe("nowrap");
    expect(line.badgeWhiteSpace).toBe("nowrap");
    expect(line.timeWhiteSpace).toBe("nowrap");
    await cell.scrollIntoViewIfNeeded();
    await captureForReview(page, "04-alerts-table-acked-line");
  });

  for (const viewport of VIEWPORTS) {
    test(`keeps the column geometry while scrolling at ${viewport.width}x${viewport.height}`, async ({
      page,
      liveSocket,
    }) => {
      await page.setViewportSize(viewport);
      await openAlerts(page);
      await seedAlerts(page, liveSocket);

      const table = page.locator("[data-data-table]");
      await expectStableColumns(table);

      const geometry = await tableGeometry(page);
      expect(geometry.layout).toBe("fixed");
      expect(geometry.minWidth).toBe(
        geometry.declaredWidths.reduce((total, width) => total + width, 0),
      );
      expect(geometry.headers.length).toBe(8);
      expect(geometry.cells.length).toBe(8);

      for (const [index, header] of geometry.headers.entries()) {
        const cell = geometry.cells[index];
        expect(header.id).toBe(cell?.id);
        expect(header.align).toBe(cell?.align);
        expect(cell?.paddingLeft ?? 0).toBeGreaterThanOrEqual(12);
        expect(cell?.paddingRight ?? 0).toBeGreaterThanOrEqual(12);
        expect(cell?.whiteSpace).toBe("nowrap");
      }

      expect(geometry.cells.find((cell) => cell.id === "time")?.align).toBe("left");
      expect(geometry.cells.find((cell) => cell.id === "actions")?.align).toBe("right");

      expect(geometry.badgeInsetLeft).not.toBeNull();
      expect(geometry.badgeInsetRight).not.toBeNull();
      expect(geometry.badgeInsetLeft ?? 0).toBeGreaterThanOrEqual(12 - 1);
      expect(geometry.badgeInsetRight ?? 0).toBeGreaterThanOrEqual(12 - 1);

      expect(new Set(geometry.rowHeights.map((height) => Math.round(height))).size).toBe(1);
      expect(Math.abs((geometry.rowHeights[0] ?? 0) - 36)).toBeLessThanOrEqual(1);

      const wholeValues = geometry.cells.filter(
        (cell) => cell.id === "plate" || cell.id === "trip",
      );
      for (const cell of wholeValues) {
        expect(cell.truncated, `${cell.id} must never truncate`).toBe(false);
      }

      if (viewport.width === 390) {
        expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
        expect(geometry.scrollWidth).toBeGreaterThanOrEqual(geometry.minWidth);
      }

      await page.locator("[data-data-table-scroll]").evaluate((element) => {
        element.scrollTop = 0;
        element.scrollLeft = 0;
      });
      await expectNoHorizontalScroll(page);
      await captureForReview(page, `04-alerts-table-${viewport.width}`);
    });
  }
});

/**
 * Measures the Alerts table against the B11 invariants. It is a diagnostic
 * script, not a test; the assertions live in e2e/alerts-table-layout.spec.ts.
 *
 * Run against a mock dev server:
 *   VITE_MOCK=1 npm run dev -- --host 127.0.0.1 --port 4173
 *   node e2e/measure/alerts-table.ts
 */
import { chromium, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;
const SEED = 200;

interface CellBox {
  index: number;
  text: string;
  x: number;
  width: number;
  height: number;
  align: string;
  whiteSpace: string;
  overflow: string;
  textOverflow: string;
  paddingLeft: number;
  paddingRight: number;
  title: string;
  hasTooltip: boolean;
  contentOverflow: string;
  contentTextOverflow: string;
  truncate: boolean;
  contentScrollWidth: number;
  contentClientWidth: number;
  contentLeft: number;
  contentRight: number;
}

interface Layout {
  tableLayout: string;
  tableWidth: number;
  tableMinWidth: number;
  scrollWidth: number;
  clientWidth: number;
  headerTop: number;
  scrollerTop: number;
  scrollerLeft: number;
  headerPosition: string;
  header: CellBox[];
  row: CellBox[];
  rowHeights: number[];
  firstColumnPosition: string;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function num(value: number): string {
  return String(round(value));
}

interface HarnessSocket {
  send: (message: string) => void;
}

async function seedAlerts(
  page: Page,
  sockets: { current: unknown }[],
): Promise<void> {
  await page.evaluate(async (count) => {
    await fetch("/api/v1/__mock/alerts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
  }, SEED);
  const socket = sockets.at(-1)?.current as HarnessSocket | undefined;
  if (!socket) throw new Error("The live socket did not open");
  socket.send(
    JSON.stringify({
      type: "alert",
      tenant_id: "tenant-demo",
      vehicle_id: "demo-imei-0001",
      severity: "high",
      occurred_at: new Date().toISOString(),
    }),
  );
  await page.waitForFunction(
    () => {
      const text =
        document.querySelector('[data-testid="alerts-page"]')?.textContent ??
        "";
      const match = text.match(/(\d+) loaded/);
      return match ? Number(match[1]) >= 200 : false;
    },
    undefined,
    { timeout: 20_000 },
  );
  await page.locator("[data-alert-row]").first().waitFor();
}

async function readLayout(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    const table = document
      .querySelector<HTMLTableElement>("[data-alert-row]")
      ?.closest("table");
    if (!table) throw new Error("The alerts table did not render");
    const scroller = table.parentElement;
    const headerCells = [
      ...table.querySelectorAll<HTMLTableCellElement>("thead th"),
    ];
    const firstRow = table.querySelector<HTMLTableRowElement>("tbody tr");
    const rowCells = firstRow
      ? [...firstRow.querySelectorAll<HTMLTableCellElement>("td")]
      : [];

    function cell(index: number, element: HTMLTableCellElement): CellBox {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const contentElement = element.querySelector<HTMLElement>(
        "[data-cell-content]",
      );
      const content = contentElement?.getBoundingClientRect() ?? rect;
      const contentStyle = contentElement
        ? window.getComputedStyle(contentElement)
        : style;
      return {
        index,
        text: (element.textContent ?? "").trim(),
        x: rect.x,
        width: rect.width,
        height: rect.height,
        align: style.textAlign,
        whiteSpace: style.whiteSpace,
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        paddingLeft: Number.parseFloat(style.paddingLeft),
        paddingRight: Number.parseFloat(style.paddingRight),
        title: element.getAttribute("title") ?? "",
        hasTooltip:
          element.hasAttribute("title") ||
          element.querySelector("[title]") !== null,
        contentOverflow: contentStyle.overflow,
        contentTextOverflow: contentStyle.textOverflow,
        truncate: contentElement?.dataset.truncate !== "false",
        contentScrollWidth: contentElement?.scrollWidth ?? 0,
        contentClientWidth: contentElement?.clientWidth ?? 0,
        contentLeft: content.left,
        contentRight: content.right,
      };
    }

    const rows = [
      ...table.querySelectorAll<HTMLTableRowElement>(
        'tbody tr[data-row="data"]',
      ),
    ];
    const tableStyle = window.getComputedStyle(table);
    const headerCell = headerCells[0];
    const scrollerRect = scroller?.getBoundingClientRect();

    return {
      tableLayout: tableStyle.tableLayout,
      tableWidth: table.getBoundingClientRect().width,
      tableMinWidth: Number.parseFloat(tableStyle.minWidth) || 0,
      scrollWidth: scroller?.scrollWidth ?? 0,
      clientWidth: scroller?.clientWidth ?? 0,
      headerTop: headerCell?.getBoundingClientRect().top ?? 0,
      scrollerTop: scrollerRect?.top ?? 0,
      scrollerLeft: scrollerRect?.left ?? 0,
      headerPosition: headerCell
        ? window.getComputedStyle(headerCell).position
        : "",
      header: headerCells.map((element, index) => cell(index, element)),
      row: rowCells.map((element, index) => cell(index, element)),
      rowHeights: rows.map((row) => row.getBoundingClientRect().height),
      firstColumnPosition: firstRow
        ? window.getComputedStyle(
            firstRow.querySelector("td") as HTMLTableCellElement,
          ).position
        : "none",
    } satisfies Layout;
  });
}

function printTable(label: string, layout: Layout): void {
  console.log(`\n### ${label}`);
  console.log(
    `table layout=${layout.tableLayout} width=${num(layout.tableWidth)} min-width=${num(layout.tableMinWidth)} scroll=${layout.scrollWidth}/${layout.clientWidth} header ${layout.headerTop}/${layout.scrollerTop} (${layout.headerPosition}) first-column=${layout.firstColumnPosition}`,
  );
  console.log(
    [
      "col".padEnd(5),
      "header x".padStart(9),
      "w".padStart(7),
      "row x".padStart(8),
      "w".padStart(7),
      "align".padEnd(6),
      "white".padEnd(8),
      "overflow".padEnd(9),
      "pad l/r".padEnd(11),
      "title".padEnd(10),
    ].join(" "),
  );
  for (const headerCell of layout.header) {
    const rowCell = layout.row[headerCell.index];
    console.log(
      [
        String(headerCell.index).padEnd(5),
        num(headerCell.x).padStart(9),
        num(headerCell.width).padStart(7),
        num(rowCell?.x ?? 0).padStart(8),
        num(rowCell?.width ?? 0).padStart(7),
        (rowCell?.align ?? "").padEnd(6),
        (rowCell?.whiteSpace ?? "").padEnd(8),
        (rowCell?.overflow ?? "").padEnd(9),
        `${num(rowCell?.paddingLeft ?? 0)}/${num(rowCell?.paddingRight ?? 0)}`.padEnd(
          11,
        ),
        (rowCell?.title ? "yes" : "no").padEnd(10),
      ].join(" "),
    );
  }
  console.log(
    `row heights: ${[...new Set(layout.rowHeights.map(num))].join(", ")}`,
  );
}

function check(label: string, layout: Layout): string[] {
  const failures: string[] = [];
  const eps = 1;

  if (layout.tableLayout !== "fixed")
    failures.push(`table-layout=${layout.tableLayout}`);
  if (layout.tableMinWidth < 1)
    failures.push("table has no explicit min-width");
  if (layout.header.some((cell) => cell.width < 1))
    failures.push("header has no column widths");

  if (layout.headerPosition !== "sticky") failures.push("header is not sticky");
  if (Math.abs(layout.headerTop - layout.scrollerTop) > eps) {
    failures.push(
      `header sticky offset ${num(layout.headerTop - layout.scrollerTop)}px from the scrollport`,
    );
  }
  if (layout.firstColumnPosition !== "sticky") {
    failures.push("first column is not sticky");
  }

  for (const [index, headerCell] of layout.header.entries()) {
    const rowCell = layout.row[index];
    if (!rowCell) {
      failures.push(`row is missing column ${index}`);
      continue;
    }
    if (Math.abs(headerCell.x - rowCell.x) > eps) {
      failures.push(
        `column ${index} x differs by ${num(headerCell.x - rowCell.x)}px`,
      );
    }
    if (Math.abs(headerCell.width - rowCell.width) > eps) {
      failures.push(
        `column ${index} width differs by ${num(headerCell.width - rowCell.width)}px`,
      );
    }
    if (rowCell.whiteSpace !== "nowrap")
      failures.push(`column ${index} white-space=${rowCell.whiteSpace}`);
    if (rowCell.truncate && rowCell.contentTextOverflow !== "ellipsis") {
      failures.push(
        `column ${index} text-overflow=${rowCell.contentTextOverflow}`,
      );
    }
    if (
      !rowCell.truncate &&
      rowCell.contentScrollWidth > rowCell.contentClientWidth + 1
    ) {
      failures.push(
        `column ${index} truncates a value that must stay whole by ${num(rowCell.contentScrollWidth - rowCell.contentClientWidth)}px`,
      );
    }
    if (rowCell.paddingLeft < 12 - eps)
      failures.push(`column ${index} left inset ${num(rowCell.paddingLeft)}px`);
    if (rowCell.paddingRight < 12 - eps)
      failures.push(
        `column ${index} right inset ${num(rowCell.paddingRight)}px`,
      );
    if (!rowCell.hasTooltip && rowCell.text !== "")
      failures.push(`column ${index} has no full-value tooltip`);

    const rightAligned = rowCell.align === "right";
    const leftAligned = rowCell.align === "left" || rowCell.align === "start";
    if (!rightAligned && !leftAligned)
      failures.push(`column ${index} align=${rowCell.align}`);
  }

  // Header alignment must equal cell alignment.
  for (const [index, headerCell] of layout.header.entries()) {
    const rowCell = layout.row[index];
    if (rowCell && headerCell.align !== rowCell.align) {
      failures.push(
        `column ${index} header align ${headerCell.align} != cell ${rowCell.align}`,
      );
    }
  }

  const distinctHeights = [...new Set(layout.rowHeights.map(num))];
  if (distinctHeights.length > 1)
    failures.push(`row heights vary: ${distinctHeights.join(", ")}`);
  if (
    distinctHeights.length === 1 &&
    Math.abs(Number(distinctHeights[0]) - 36) > eps
  ) {
    failures.push(`row height ${distinctHeights[0]}px != 36px`);
  }

  if (layout.scrollWidth > layout.clientWidth) {
    // The table min-width must be the horizontal overflow source, not a cell.
    if (layout.tableWidth + eps < layout.scrollWidth) {
      failures.push("table does not fill its horizontal scroll width");
    }
  }

  console.log(
    failures.length === 0
      ? `PASS ${label}`
      : `FAIL ${label}: ${failures.join("; ")}`,
  );
  return failures;
}

async function scrollAndMeasure(
  page: Page,
): Promise<{ before: Layout; afterVertical: Layout; afterHorizontal: Layout }> {
  const scroller = page.locator("[data-data-table-scroll]").first();
  const before = await readLayout(page);
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight / 2;
  });
  await page.waitForTimeout(250);
  const afterVertical = await readLayout(page);
  await scroller.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await page.waitForTimeout(250);
  const afterHorizontal = await readLayout(page);
  return { before, afterVertical, afterHorizontal };
}

async function main(): Promise<void> {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
    args: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? ["--no-sandbox", "--disable-dev-shm-usage"]
      : [],
  });
  const allFailures: string[] = [];
  try {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({ viewport });
        await context.addInitScript((value) => {
          localStorage.setItem("fleet.theme", value as string);
        }, theme);
        const page = await context.newPage();
        const sockets: { current: unknown }[] = [];
        await page.routeWebSocket(/\/api\/v1\/live\/ws$/, (socket) => {
          sockets.push({ current: socket });
        });
        await page.goto(`${BASE_URL}/alerts?map=fake`);
        await page.getByRole("heading", { name: "Alerts" }).waitFor();
        await page.getByRole("columnheader", { name: "Plate" }).waitFor();
        await seedAlerts(page, sockets);

        const label = `${theme} ${viewport.width}x${viewport.height}`;
        const { before, afterVertical, afterHorizontal } =
          await scrollAndMeasure(page);
        printTable(label, before);
        const failures = check(label, before);

        // Vertical scrolling must not move or resize any column.
        for (const [index, headerCell] of before.header.entries()) {
          const moved = afterVertical.header[index];
          if (!moved) {
            failures.push(`column ${index} disappeared after scrolling`);
            continue;
          }
          if (Math.abs(headerCell.x - moved.x) > 1) {
            failures.push(
              `column ${index} moved ${num(moved.x - headerCell.x)}px while scrolling`,
            );
          }
          if (Math.abs(headerCell.width - moved.width) > 1) {
            failures.push(
              `column ${index} resized ${num(moved.width - headerCell.width)}px while scrolling`,
            );
          }
        }
        // Horizontal scrolling must keep widths and only move non-sticky columns.
        for (const [index, headerCell] of before.header.entries()) {
          const moved = afterHorizontal.header[index];
          if (!moved) continue;
          if (Math.abs(headerCell.width - moved.width) > 1) {
            failures.push(
              `column ${index} resized ${num(moved.width - headerCell.width)}px while scrolling horizontally`,
            );
          }
          if (
            index === 0 &&
            Math.abs(moved.x - afterHorizontal.scrollerLeft) > 1
          ) {
            failures.push("first column did not stay at the scrollport edge");
          }
        }
        if (afterVertical.headerPosition !== "sticky")
          failures.push("header lost sticky after scrolling");
        if (Math.abs(afterVertical.headerTop - afterVertical.scrollerTop) > 1) {
          failures.push(
            `header is ${num(afterVertical.headerTop - afterVertical.scrollerTop)}px off the scrollport after scrolling`,
          );
        }
        const beforeHeight = before.rowHeights[0];
        const afterHeight = afterVertical.rowHeights[0];
        if (beforeHeight !== afterHeight) {
          failures.push(
            `row height changed from ${num(beforeHeight ?? 0)}px to ${num(afterHeight ?? 0)}px while scrolling`,
          );
        }

        if (failures.length) {
          for (const failure of failures)
            allFailures.push(`${label}: ${failure}`);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log("\n=== FAILING INVARIANTS ===");
  if (allFailures.length === 0) console.log("none");
  for (const failure of allFailures) console.log(failure);
}

void main();

/**
 * Measures the mobile vehicles sheet header and list against the B11 invariants.
 *
 * Run against a mock dev server:
 *   VITE_MOCK=1 npm run dev -- --host 127.0.0.1 --port 4173
 *   npx tsx e2e/measure/sheet-header.ts
 *
 * Prints one table per viewport, theme, snap and scroll state. It is a
 * diagnostic script, not a test; the assertions live in e2e/sheet-header.spec.ts.
 */
import { chromium, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 412, height: 915 },
] as const;
const THEMES = ["light", "dark"] as const;
const SNAPS = ["peek", "half", "full"] as const;
const SCROLLS = ["top", "middle", "end"] as const;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  boxSizing: string;
  overflowX: string;
  overflowY: string;
  position: string;
  zIndex: string;
  backgroundColor: string;
  borderBottom: string;
  padding: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  marginTop: string;
  marginBottom: string;
  display: string;
  flexShrink: string;
  transform: string;
  sticky: boolean;
  insideScroller: boolean;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

async function snapshot(
  page: Page,
): Promise<Record<string, Box | null | number>> {
  return page.evaluate(() => {
    const scroller =
      document.querySelector('ul[aria-label="Vehicles"]')?.parentElement ??
      null;
    const selectors: Record<string, Element | null> = {
      sheet: document.querySelector('section[aria-label="Vehicles"]'),
      header: document.querySelector('[data-testid="sheet-header"]'),
      handle: document.querySelector(
        '[data-testid="sheet-header"] > span[aria-hidden="true"]',
      ),
      titleRow: document.querySelector(
        '[data-testid="sheet-header"] > div:nth-of-type(1)',
      ),
      searchRow: document.querySelector(
        '[data-testid="sheet-header"] > div:nth-of-type(2)',
      ),
      search: document.querySelector(
        '[data-testid="sheet-header"] input[type="search"]',
      ),
      searchCell:
        document.querySelector(
          '[data-testid="sheet-header"] input[type="search"]',
        )?.parentElement?.parentElement ?? null,
      scroller,
      list: document.querySelector('ul[aria-label="Vehicles"]'),
      firstRow: document.querySelector("[data-vehicle-key]"),
      firstRowContent: document.querySelector(
        "[data-vehicle-key] div.pointer-events-none",
      ),
      lastRow:
        [...document.querySelectorAll("[data-vehicle-key]")].at(-1) ?? null,
      safeProbe: (() => {
        const probe = document.createElement("div");
        probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
        document.body.append(probe);
        const value = probe;
        queueMicrotask(() => value.remove());
        return value;
      })(),
    };
    const result: Record<string, Box | null | number> = {};
    result.viewportWidth = window.innerWidth;
    result.viewportHeight = window.innerHeight;
    for (const [name, element] of Object.entries(selectors)) {
      if (!element) {
        result[name] = null;
        continue;
      }
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      result[name] = {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        right: Math.round(rect.right * 100) / 100,
        bottom: Math.round(rect.bottom * 100) / 100,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        boxSizing: style.boxSizing,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        position: style.position,
        zIndex: style.zIndex,
        backgroundColor: style.backgroundColor,
        borderBottom: `${style.borderBottomWidth} ${style.borderBottomStyle} ${style.borderBottomColor}`,
        padding: style.padding,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        marginTop: style.marginTop,
        marginBottom: style.marginBottom,
        display: style.display,
        flexShrink: style.flexShrink,
        transform: style.transform,
        sticky: style.position === "sticky" || style.position === "fixed",
        insideScroller: scroller ? scroller.contains(element) : false,
      };
    }
    return result;
  });
}

type Table = Record<string, Box | null | number>;

function num(value: number | undefined): string {
  return value === undefined ? "—" : String(round(value));
}

function tableHeader(label: string): void {
  console.log(`\n### ${label}`);
  console.log(
    [
      "element".padEnd(10),
      "x".padStart(8),
      "y".padStart(8),
      "w".padStart(8),
      "h".padStart(8),
      "box".padEnd(11),
      "overflow".padEnd(12),
      "pos".padEnd(8),
      "z".padStart(4),
      "bg".padEnd(22),
      "border-bottom".padEnd(30),
      "padding (t r b l)".padEnd(28),
      "clientW/scrollW",
    ].join(" "),
  );
}

function tableRow(name: string, box: Box | null): void {
  if (!box) {
    console.log(`${name.padEnd(10)} missing`);
    return;
  }
  console.log(
    [
      name.padEnd(10),
      num(box.x).padStart(8),
      num(box.y).padStart(8),
      num(box.width).padStart(8),
      num(box.height).padStart(8),
      box.boxSizing.padEnd(11),
      `${box.overflowX}/${box.overflowY}`.padEnd(12),
      box.position.padEnd(8),
      box.zIndex.padStart(4),
      box.backgroundColor.padEnd(22),
      box.borderBottom.padEnd(30),
      `${box.paddingTop} ${box.paddingRight} ${box.paddingBottom} ${box.paddingLeft}`.padEnd(
        28,
      ),
      `${box.clientWidth}/${box.scrollWidth}`,
    ].join(" "),
  );
}

/** Returns the failing invariants with their measured px delta. */
function check(table: Table, scroll: string): string[] {
  const failures: string[] = [];
  const get = (name: string): Box | null => {
    const value = table[name];
    return value !== null && typeof value === "object" ? value : null;
  };
  const sheet = get("sheet");
  const header = get("header");
  const search = get("search");
  const searchRow = get("searchRow");
  const scroller = get("scroller");
  const list = get("list");
  const row = get("firstRow");
  const rowContent = get("firstRowContent");
  const lastRow = get("lastRow");
  const safeProbe = get("safeProbe");
  const viewportHeight = Number(table.viewportHeight ?? 0);
  if (!sheet || !header || !search || !scroller || !list || !row) {
    return ["missing measured element"];
  }

  const eps = 0.5;

  if (Math.abs(header.x - sheet.x) > eps)
    failures.push(`header left vs sheet left: ${num(header.x - sheet.x)}px`);
  if (Math.abs(header.right - sheet.right) > eps)
    failures.push(
      `header right vs sheet right: ${num(header.right - sheet.right)}px`,
    );
  if (Math.abs(header.bottom - scroller.y) > eps)
    failures.push(
      `list top vs header bottom: ${num(scroller.y - header.bottom)}px`,
    );
  if (header.bottom > viewportHeight + eps)
    failures.push(
      `header below viewport: ${num(header.bottom - viewportHeight)}px`,
    );

  if (search.boxSizing !== "border-box")
    failures.push(`search box-sizing: ${search.boxSizing}`);
  const leftInset = search.x - header.x;
  const rightInset = header.right - search.right;
  if (Math.abs(leftInset - 12) > eps)
    failures.push(`search left inset: ${num(leftInset)}px`);
  if (Math.abs(rightInset - 12) > eps)
    failures.push(`search right inset: ${num(rightInset)}px`);
  if (num(search.width) > num(header.width - 24))
    failures.push(
      `search wider than header content: ${num(search.width - (header.width - 24))}px`,
    );
  if (searchRow && search.y - searchRow.y < 8)
    failures.push(
      `space above search in row: ${num(search.y - searchRow.y)}px`,
    );
  if (header.bottom - search.bottom < 8)
    failures.push(
      `space below search: ${num(header.bottom - search.bottom)}px`,
    );

  if (scroller.y < header.bottom - eps)
    failures.push(
      `list starts inside header: ${num(header.bottom - scroller.y)}px`,
    );
  if (scroll === "top" && row.y < scroller.y - 1)
    failures.push(`row not clipped at list top: ${num(scroller.y - row.y)}px`);
  if (row.x < header.x - eps || row.right > header.right + eps)
    failures.push(
      `row outside header width: ${num(row.x - header.x)}/${num(row.right - header.right)}px`,
    );
  if (rowContent) {
    const paddingLeft = Number.parseFloat(rowContent.paddingLeft);
    const paddingRight = Number.parseFloat(rowContent.paddingRight);
    if (Math.abs(paddingLeft - 12) > eps)
      failures.push(`row content left padding: ${num(paddingLeft)}px`);
    if (Math.abs(paddingRight - 12) > eps)
      failures.push(`row content right padding: ${num(paddingRight)}px`);
  }

  if (header.scrollWidth > header.clientWidth)
    failures.push(
      `header h-overflow: ${header.scrollWidth - header.clientWidth}px`,
    );
  if (scroller.scrollWidth > scroller.clientWidth)
    failures.push(
      `list h-overflow: ${scroller.scrollWidth - scroller.clientWidth}px`,
    );

  if (header.sticky || header.insideScroller)
    failures.push("header is sticky or inside the scrolling list");
  if (header.position === "static" || Number.parseInt(header.zIndex, 10) < 1) {
    failures.push("header is not a positioned layer above the list");
  }
  if (header.backgroundColor !== sheet.backgroundColor) {
    failures.push(
      `header bg ${header.backgroundColor} vs sheet ${sheet.backgroundColor}`,
    );
  }
  if (!header.backgroundColor.startsWith("rgb("))
    failures.push(`header bg is not opaque: ${header.backgroundColor}`);

  if (scroll === "end") {
    if (lastRow && lastRow.bottom > scroller.bottom + 1)
      failures.push(
        `last row below scroller: ${num(lastRow.bottom - scroller.bottom)}px`,
      );
    const safeBottom = safeProbe
      ? Number.parseFloat(safeProbe.paddingBottom)
      : 0;
    if (
      safeBottom > 0 &&
      lastRow &&
      lastRow.bottom > scroller.bottom - safeBottom + 1
    ) {
      failures.push(
        `last row in safe area: ${num(lastRow.bottom - (scroller.bottom - safeBottom))}px`,
      );
    }
  }
  return failures;
}

async function setSnap(
  page: Page,
  snap: (typeof SNAPS)[number],
): Promise<void> {
  const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
  await handle.focus();
  if (snap === "peek") await page.keyboard.press("Home");
  if (snap === "half") {
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowUp");
  }
  if (snap === "full") await page.keyboard.press("End");
  await page.waitForTimeout(350);
}

async function setScroll(
  page: Page,
  scroll: (typeof SCROLLS)[number],
): Promise<void> {
  await page.evaluate((mode) => {
    const element = document.querySelector(
      'ul[aria-label="Vehicles"]',
    )?.parentElement;
    if (!element) return;
    if (mode === "top") element.scrollTop = 0;
    if (mode === "middle")
      element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
    if (mode === "end") element.scrollTop = element.scrollHeight;
  }, scroll);
  await page.waitForTimeout(120);
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
        await page.goto(`${BASE_URL}/map?map=fake`);
        await page.getByRole("region", { name: "Live map" }).waitFor();
        await page.getByText(/Showing \d+ of \d+/).waitFor();
        await page.locator("[data-vehicle-key]").first().waitFor();

        for (const snap of SNAPS) {
          await setSnap(page, snap);
          for (const scroll of SCROLLS) {
            await setScroll(page, scroll);
            const table = await snapshot(page);
            const label = `${theme} ${viewport.width}x${viewport.height} ${snap} scroll=${scroll}`;
            tableHeader(label);
            for (const name of [
              "sheet",
              "header",
              "handle",
              "titleRow",
              "searchRow",
              "search",
              "searchCell",
              "scroller",
              "list",
              "firstRow",
              "firstRowContent",
              "lastRow",
              "safeProbe",
            ]) {
              const value = table[name];
              tableRow(
                name,
                value !== null && typeof value === "object" ? value : null,
              );
            }
            const failures = check(table, scroll);
            const header = table.header;
            const viewportHeight = Number(table.viewportHeight ?? 0);
            if (
              snap === "peek" &&
              header !== null &&
              typeof header === "object" &&
              Math.abs(header.bottom - viewportHeight) > 0.5
            ) {
              failures.push(
                `peek header bottom vs viewport: ${num(header.bottom - viewportHeight)}px`,
              );
            }
            if (failures.length) {
              allFailures.push(`${label}: ${failures.join("; ")}`);
              console.log(`FAIL ${failures.join("; ")}`);
            } else {
              console.log("PASS");
            }
          }
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

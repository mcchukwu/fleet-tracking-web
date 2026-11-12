import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export type ReviewTheme = "light" | "dark";

export async function setStoredTheme(
  page: Page,
  theme: ReviewTheme,
): Promise<void> {
  await page.addInitScript((value) => {
    try {
      localStorage.setItem("fleet.theme", value);
    } catch {
      // Storage may be unavailable in a hardened browser; the app falls back to system.
    }
  }, theme);
}

const OFFLINE_PROFILE_KEY = "fleet.offline-profile";

/**
 * Seeds the minimal offline profile so a first load can run without the
 * network, then makes every later navigation report offline. A static
 * same-origin document is used so the app does not boot and warm the cache.
 */
export async function primeOfflineSession(page: Page): Promise<void> {
  await page.goto("/favicon.svg");
  await page.evaluate(
    async ({ key }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("keyval-store");
        request.onupgradeneeded = () => request.result.createObjectStore("keyval");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("keyval", "readwrite");
        transaction.objectStore("keyval").put(
          {
            user: {
              id: "00000000-0000-0000-0000-000000000102",
              tenant_id: "tenant-demo",
              email: "dispatcher@demo.ftb",
              name: "Demo Dispatcher",
              role: "dispatcher",
            },
            savedAt: Date.now(),
          },
          key,
        );
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    },
    { key: OFFLINE_PROFILE_KEY },
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
  });
}

export async function expectTheme(
  page: Page,
  theme: ReviewTheme,
): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe(theme);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows, "page has horizontal scroll").toBe(false);
}

export async function expectNoAxeViolations(
  page: Page,
  disabledRules: readonly string[] = [],
): Promise<void> {
  const builder = new AxeBuilder({ page });
  if (disabledRules.length > 0) builder.disableRules([...disabledRules]);
  const results = await builder.analyze();
  expect(
    results.violations,
    results.violations
      .map((violation) => `${violation.id}: ${violation.help}`)
      .join("\n"),
  ).toEqual([]);
}

export async function expectFocusVisible(locator: Locator): Promise<void> {
  await locator.focus();
  const focus = await locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      boxShadow: style.boxShadow,
    };
  });
  // Inputs use an inset focus ring instead of an outline (design-system §12).
  const hasOutline = focus.outlineStyle !== "none" && focus.outlineWidth > 0;
  const hasRing =
    focus.boxShadow !== "none" && /[1-9]\d*px/.test(focus.boxShadow);
  expect(
    hasOutline || hasRing,
    "focused element has no visible focus indicator",
  ).toBe(true);
}

export async function expectTabularNums(locator: Locator): Promise<void> {
  const value = await locator.evaluate(
    (element) => window.getComputedStyle(element).fontVariantNumeric,
  );
  expect(value).toContain("tabular-nums");
}

export async function expectNoOverlap(a: Locator, b: Locator): Promise<void> {
  const first = await a.boundingBox();
  const second = await b.boundingBox();
  expect(first, "first element has no box").not.toBeNull();
  expect(second, "second element has no box").not.toBeNull();
  if (!first || !second) return;
  const overlaps =
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y;
  expect(overlaps, "floating panels overlap").toBe(false);
}

export async function expectTouchTargets(
  page: Page,
  minimum = 44,
  exclude?: string,
): Promise<void> {
  const tooSmall = await page.evaluate(({ size, skip }) => {
    const selector =
      'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        if (
          rect.width === 0 ||
          rect.height === 0 ||
          style.visibility === "hidden" ||
          (skip !== null && element.matches(skip))
        )
          return false;
        // A checkbox or radio is one target with its wrapping label.
        const label = element.closest("label");
        if (
          label &&
          element.matches('input[type="checkbox"], input[type="radio"]')
        ) {
          const box = label.getBoundingClientRect();
          if (box.width >= size && box.height >= size) return false;
        }
        return true;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute("aria-label") ??
            element.textContent?.trim() ??
            element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((target) => target.width < size || target.height < size);
  }, { size: minimum, skip: exclude ?? null });
  expect(tooSmall, `touch targets below ${minimum}px`).toEqual([]);
}

export async function expectMinimumContrast(
  locator: Locator,
  minimum: number,
): Promise<void> {
  const ratio = await locator.evaluate((element) => {
    const parse = (value: string): [number, number, number] => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) throw new Error(`Unsupported colour: ${value}`);
      const channels = match[1]
        .split(",")
        .map((part) => Number.parseFloat(part.trim()));
      return [channels[0], channels[1], channels[2]];
    };
    const luminance = ([red, green, blue]: [
      number,
      number,
      number,
    ]): number => {
      const linear = (value: number): number => {
        const normalized = value / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return (
        0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
      );
    };

    let node: Element | null = element;
    let background = "rgba(0, 0, 0, 0)";
    while (node) {
      const value = window.getComputedStyle(node).backgroundColor;
      if (value !== "rgba(0, 0, 0, 0)" && value !== "transparent") {
        background = value;
        break;
      }
      node = node.parentElement;
    }

    const foregroundLuminance = luminance(
      parse(window.getComputedStyle(element).color),
    );
    const backgroundLuminance = luminance(parse(background));
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);
    return (lighter + 0.05) / (darker + 0.05);
  });

  expect(
    ratio,
    `contrast ${ratio.toFixed(2)}:1 is below ${minimum}:1`,
  ).toBeGreaterThanOrEqual(minimum);
}

export async function captureForReview(
  page: Page,
  name: string,
): Promise<void> {
  if (process.env.REVIEW !== "1") return;
  const theme = await page.evaluate(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  const viewport = page.viewportSize();
  const viewportName = viewport
    ? `${viewport.width}x${viewport.height}`
    : "unknown";
  const directory = join(process.cwd(), "test-results", "review");
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: join(directory, `${name}-${theme}-${viewportName}.png`),
    fullPage: false,
  });
}

interface ColumnMeasurement {
  id: string;
  x: number;
  width: number;
  align: string;
}

interface DataTableMeasurement {
  scrollerLeft: number;
  scrollerTop: number;
  scrollLeft: number;
  scrollTop: number;
  headers: ColumnMeasurement[];
  cells: ColumnMeasurement[];
  rowHeights: number[];
}

async function measureColumns(table: Locator): Promise<DataTableMeasurement> {
  return table.evaluate((root) => {
    const scroller = root.querySelector<HTMLElement>(
      "[data-data-table-scroll]",
    );
    const element = root.querySelector<HTMLTableElement>("table");
    if (!scroller || !element)
      throw new Error("The data table is missing its scroller or table");
    const scrollerRect = scroller.getBoundingClientRect();
    const read = (cell: HTMLTableCellElement): ColumnMeasurement => {
      const rect = cell.getBoundingClientRect();
      return {
        id: cell.dataset.columnId ?? "",
        x: rect.x - scrollerRect.left + scroller.scrollLeft,
        width: rect.width,
        align: window.getComputedStyle(cell).textAlign,
      };
    };
    const headers = [
      ...element.querySelectorAll<HTMLTableCellElement>("thead th"),
    ].map(read);
    const firstRow = element.querySelector<HTMLTableRowElement>(
      'tbody tr[data-row="data"]',
    );
    const cells = firstRow
      ? [...firstRow.querySelectorAll<HTMLTableCellElement>("td")].map(read)
      : [];
    const rowHeights = [
      ...element.querySelectorAll<HTMLTableRowElement>(
        'tbody tr[data-row="data"]',
      ),
    ].map((row) => row.getBoundingClientRect().height);
    return {
      scrollerLeft: scrollerRect.left,
      scrollerTop: scrollerRect.top,
      scrollLeft: scroller.scrollLeft,
      scrollTop: scroller.scrollTop,
      headers,
      cells,
      rowHeights,
    };
  });
}

/**
 * Proves a DataTable's column geometry cannot change while the user scrolls.
 * Widths and content-relative x positions survive vertical and horizontal
 * movement, the header sticks to the scrollport, alignment never changes and
 * every data row keeps the fixed row height.
 */
export async function expectStableColumns(
  table: Locator,
  rowHeight = 36,
): Promise<void> {
  const scroller = table.locator("[data-data-table-scroll]").first();
  const before = await measureColumns(table);
  const headerRowBox = await table.locator("thead tr").first().boundingBox();
  const firstDataRowBox = await table
    .locator('tbody tr[data-row="data"]')
    .first()
    .boundingBox();
  if (headerRowBox && firstDataRowBox) {
    expect(
      Math.abs(firstDataRowBox.y - (headerRowBox.y + headerRowBox.height)),
      "the first row is not flush under the header",
    ).toBeLessThanOrEqual(1);
  }

  const canScrollVertically = await scroller.evaluate(
    (element) => element.scrollHeight > element.clientHeight + 1,
  );
  let afterVertical = before;
  if (canScrollVertically) {
    await scroller.evaluate((element) => {
      element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
    });
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    afterVertical = await measureColumns(table);
  }

  for (const [index, header] of before.headers.entries()) {
    const moved = afterVertical.headers[index];
    expect(
      moved,
      `column ${header.id} disappeared after vertical scrolling`,
    ).toBeDefined();
    if (!moved) continue;
    expect(
      moved.width,
      `column ${header.id} resized while scrolling`,
    ).toBeCloseTo(header.width, 0);
    expect(moved.x, `column ${header.id} moved while scrolling`).toBeCloseTo(
      header.x,
      0,
    );
    expect(
      moved.align,
      `column ${header.id} alignment changed while scrolling`,
    ).toBe(header.align);
  }

  expect(
    Math.abs(afterVertical.scrollerTop - before.scrollerTop),
    "the table moved while scrolling",
  ).toBeLessThanOrEqual(1);
  const stickyHeader = table.locator("thead th").first();
  const headerBox = await stickyHeader.boundingBox();
  const scrollerBox = await scroller.boundingBox();
  if (!headerBox || !scrollerBox)
    throw new Error("The table header has no box");
  expect(
    Math.abs(headerBox.y - scrollerBox.y),
    "the header did not stay at the top of the scrollport",
  ).toBeLessThanOrEqual(1);

  const heights = afterVertical.rowHeights.map((height) => Math.round(height));
  expect(
    new Set(heights).size,
    "rows have different heights",
  ).toBeLessThanOrEqual(1);
  if (heights[0] !== undefined) {
    expect(Math.abs(heights[0] - rowHeight)).toBeLessThanOrEqual(1);
  }

  const rowGaps = await table.evaluate((root) => {
    const rows = [
      ...root.querySelectorAll<HTMLTableRowElement>(
        'tbody tr[data-row="data"]',
      ),
    ];
    return rows.slice(1).map((row, index) => {
      const previous = rows[index];
      if (!previous) return 0;
      return (
        row.getBoundingClientRect().top -
        previous.getBoundingClientRect().bottom
      );
    });
  });
  for (const gap of rowGaps) {
    expect(Math.abs(gap), "rows are not contiguous").toBeLessThanOrEqual(1);
  }

  for (const [index, header] of before.headers.entries()) {
    const cell = before.cells[index];
    if (!cell) continue;
    expect(cell.align, `column ${header.id} header and cells disagree`).toBe(
      header.align,
    );
    expect(
      cell.width,
      `column ${header.id} header and cells disagree on width`,
    ).toBeCloseTo(header.width, 0);
    expect(
      cell.x,
      `column ${header.id} header and cells disagree on position`,
    ).toBeCloseTo(header.x, 0);
  }

  const canScrollHorizontally = await scroller.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 1,
  );
  if (!canScrollHorizontally) return;

  await scroller.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  const afterHorizontal = await measureColumns(table);

  for (const [index, header] of before.headers.entries()) {
    const moved = afterHorizontal.headers[index];
    if (!moved) continue;
    expect(
      moved.width,
      `column ${header.id} resized while scrolling horizontally`,
    ).toBeCloseTo(header.width, 0);
    if (index === 0) {
      expect(
        Math.abs(moved.x - afterHorizontal.scrollLeft),
        "the first column did not stay at the scrollport edge",
      ).toBeLessThanOrEqual(1);
    } else {
      expect(
        moved.x,
        `column ${header.id} shifted its content while scrolling`,
      ).toBeCloseTo(header.x, 0);
    }
  }
}

interface FakeVisualViewport {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
  scale: number;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
  dispatchEvent: (event: Event) => boolean;
}

/**
 * Emulates the visual viewport shrinking when the software keyboard opens.
 * The layout viewport, and therefore the dialog, must not change.
 */
export async function emulateSoftwareKeyboard(
  page: Page,
  height: number,
): Promise<void> {
  await page.evaluate((keyboard) => {
    const real = window.visualViewport;
    const listeners: EventListener[] = [];
    const fake: FakeVisualViewport = {
      width: real?.width ?? window.innerWidth,
      height: window.innerHeight - keyboard,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 1,
      addEventListener: (type, listener) => {
        if (type === "resize" || type === "scroll") listeners.push(listener);
      },
      removeEventListener: (type, listener) => {
        if (type !== "resize" && type !== "scroll") return;
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      },
      dispatchEvent: (event) => {
        for (const listener of listeners) listener(event);
        return true;
      },
    };
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: fake,
    });
    Object.defineProperty(window, "__FLEET_TEST_VISUAL_VIEWPORT__", {
      configurable: true,
      value: fake,
    });
    fake.dispatchEvent(new Event("resize"));
  }, height);
}

/**
 * Pans the emulated visual viewport the way a mobile browser does to reveal
 * the focused field. Used when the picker sits low on a long page.
 */
export async function revealInVisualViewport(
  locator: Locator,
): Promise<void> {
  await locator.evaluate((element) => {
    const viewport = window.__FLEET_TEST_VISUAL_VIEWPORT__;
    if (!viewport) return;
    const rect = element.getBoundingClientRect();
    let offset = viewport.offsetTop;
    if (rect.bottom > offset + viewport.height - 8) {
      offset = rect.bottom - viewport.height + 8;
    }
    if (rect.top < offset + 8) offset = Math.max(0, rect.top - 8);
    if (offset === viewport.offsetTop) return;
    viewport.offsetTop = offset;
    viewport.dispatchEvent(new Event("resize"));
  });
}

/**
 * Measures the mobile vehicles sheet rows and the map attribution against the
 * B11 invariants. It is a diagnostic script, not a test; the assertions live in
 * e2e/sheet-rows.spec.ts.
 *
 * Run against a mock dev server:
 *   VITE_MOCK=1 npm run dev -- --host 127.0.0.1 --port 4173
 *   node e2e/measure/sheet-rows.ts
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
const FLEETS = [1, 3, 25, 5000] as const;

type Snap = (typeof SNAPS)[number];
type Scroll = (typeof SCROLLS)[number];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  fontSize: string;
  lineHeight: string;
  whiteSpace: string;
  display: string;
  position: string;
  paddingTop: string;
  paddingBottom: string;
  borderTopWidth: string;
  borderBottomWidth: string;
  overflowY: string;
  scrollHeight: number;
  clientHeight: number;
  opacity: string;
}

interface RowBox extends Box {
  content: Box | null;
  firstLine: Box | null;
  secondLine: Box | null;
  contentJustify: string;
  contentAlign: string;
  contentBottom: number;
  inlineActionHeight: number;
}

interface Layout {
  viewportWidth: number;
  viewportHeight: number;
  sheet: Box;
  header: Box;
  scroller: Box;
  list: Box;
  listCssHeight: number;
  rows: RowBox[];
  controls: Box;
  attribution: Box;
  attributionText: string;
  attributionLineCount: number;
  sheetTop: number;
  sheetBottom: number;
  vehicleCount: number;
  harness: Box | null;
  panel: Box | null;
  safeBottom: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function num(value: number | undefined): string {
  return value === undefined ? "—" : String(round(value));
}

async function readLayout(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    function box(element: Element | null): Box | null {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        whiteSpace: style.whiteSpace,
        display: style.display,
        position: style.position,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        borderTopWidth: style.borderTopWidth,
        borderBottomWidth: style.borderBottomWidth,
        overflowY: style.overflowY,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        opacity: style.opacity,
      };
    }

    const sheet = document.querySelector<HTMLElement>(
      'section[aria-label="Vehicles"]',
    );
    const header = document.querySelector<HTMLElement>(
      '[data-testid="sheet-header"]',
    );
    const list = document.querySelector<HTMLElement>(
      'ul[aria-label="Vehicles"]',
    );
    const scroller = list?.parentElement ?? null;
    const rows = [
      ...document.querySelectorAll<HTMLElement>("[data-vehicle-key]"),
    ].map((row) => {
      const content = row.querySelector<HTMLElement>("div.pointer-events-none");
      const lines = content
        ? [...content.children].map((child) => box(child))
        : [];
      const contentStyle = content ? window.getComputedStyle(content) : null;
      const action = row.querySelector<HTMLElement>(
        "[data-row-inline-action] button",
      );
      return {
        ...box(row),
        content: box(content),
        firstLine: lines[0] ?? null,
        secondLine: lines[1] ?? null,
        contentJustify: contentStyle?.justifyContent ?? "",
        contentAlign: contentStyle?.alignItems ?? "",
        contentBottom: lines[lines.length - 1]?.bottom ?? 0,
        inlineActionHeight: action?.getBoundingClientRect().height ?? 0,
      } as RowBox;
    });
    const controls = document.querySelector<HTMLElement>(
      'fieldset[aria-label="Map controls"]',
    );
    const attribution =
      document.querySelector<HTMLElement>(
        '.map-bottom-anchor a[href], .map-bottom-anchor [data-testid="map-attribution"]',
      ) ?? null;
    const harness = document.querySelector<HTMLElement>(
      '[data-testid="map-inset-harness"]',
    );
    const panel = document.querySelector<HTMLElement>("aside");
    const probe = document.createElement("div");
    probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
    document.body.append(probe);
    const safeBottom = Number.parseFloat(
      window.getComputedStyle(probe).paddingBottom,
    );
    probe.remove();

    if (!sheet || !header || !scroller || !list || !controls || !attribution) {
      throw new Error("The sheet or the map footer did not render");
    }

    const attributionStyle = window.getComputedStyle(attribution);
    const lineHeight = Number.parseFloat(attributionStyle.lineHeight);
    const range = document.createRange();
    range.selectNodeContents(attribution);
    const lineCount =
      lineHeight > 0
        ? Math.max(
            1,
            Math.round(range.getBoundingClientRect().height / lineHeight),
          )
        : 0;

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      sheet: box(sheet) as Box,
      header: box(header) as Box,
      scroller: box(scroller) as Box,
      list: box(list) as Box,
      listCssHeight: Number.parseFloat(list.style.height),
      rows,
      controls: box(controls) as Box,
      attribution: box(attribution) as Box,
      attributionText: attribution.textContent?.trim() ?? "",
      attributionLineCount: lineCount,
      sheetTop: sheet.getBoundingClientRect().top,
      sheetBottom: sheet.getBoundingClientRect().bottom,
      vehicleCount: Number(sheet.dataset.vehicleCount ?? ""),
      harness: box(harness),
      panel: box(panel),
      safeBottom,
    };
  });
}

function table(label: string, layout: Layout): void {
  console.log(`\n### ${label} fleet=${layout.rows.length ? "" : ""}`);
  console.log(
    [
      "element".padEnd(14),
      "x".padStart(8),
      "y".padStart(8),
      "w".padStart(8),
      "h".padStart(8),
      "font".padStart(6),
      "line".padStart(6),
      "pad t/b".padEnd(13),
      "border b".padStart(8),
      "overflow".padEnd(8),
      "scroll/client".padEnd(14),
      "opacity".padStart(7),
    ].join(" "),
  );
  for (const name of [
    "sheet",
    "header",
    "scroller",
    "list",
    "controls",
    "attribution",
  ] as const) {
    const element = layout[name];
    console.log(
      [
        name.padEnd(14),
        num(element.x).padStart(8),
        num(element.y).padStart(8),
        num(element.width).padStart(8),
        num(element.height).padStart(8),
        element.fontSize.padStart(6),
        element.lineHeight.padStart(6),
        `${element.paddingTop}/${element.paddingBottom}`.padEnd(13),
        element.borderBottomWidth.padStart(8),
        element.overflowY.padEnd(8),
        `${element.scrollHeight}/${element.clientHeight}`.padEnd(14),
        element.opacity.padStart(7),
      ].join(" "),
    );
  }
  const first = layout.rows[0];
  const last = layout.rows[layout.rows.length - 1];
  if (first) {
    console.log(
      `rows: ${layout.rows.length} rendered; first y=${num(first.y)} h=${num(first.height)} content h=${num(first.content?.height)} content top=${num(first.content?.y)} content bottom=${num(first.content?.bottom)} justify=${first.contentJustify} align=${first.contentAlign} action h=${num(first.inlineActionHeight)} gap-to-divider=${num(first.bottom - 1 - first.contentBottom)}`,
    );
    if (last && layout.rows.length > 1) {
      console.log(
        `last row y=${num(last.y)} h=${num(last.height)} bottom=${num(last.bottom)}; list height style=${num(layout.listCssHeight)}`,
      );
    }
  }
  console.log(
    `attribution "${layout.attributionText}" font=${layout.attribution.fontSize} lines=${layout.attributionLineCount} white-space=${layout.attribution.whiteSpace} right=${num(layout.attribution.right)} controls bottom=${num(layout.controls.bottom)} sheet top=${num(layout.sheetTop)}`,
  );
}

function check(layout: Layout, snap: Snap, scroll: Scroll): string[] {
  const failures: string[] = [];
  const eps = 1;
  const rows = layout.rows;
  const first = rows[0];
  const last = rows[rows.length - 1];

  // A collapsed sheet has no list viewport, so no rows are rendered.
  if (snap === "peek") {
    if (rows.length !== 0) failures.push(`peek rendered ${rows.length} rows`);
    if (Math.abs(layout.sheetBottom - layout.viewportHeight) > eps) {
      failures.push(
        `peek sheet bottom vs viewport ${num(layout.sheetBottom - layout.viewportHeight)}px`,
      );
    }
    return failures;
  }

  if (!first) return ["no rows rendered"];

  // Every row is 56px, consecutive rows touch and the list is their exact sum.
  for (const [index, row] of rows.entries()) {
    if (Math.abs(row.height - 56) > eps) {
      failures.push(`row ${index} height ${num(row.height)}px`);
    }
    const next = rows[index + 1];
    if (next && Math.abs(row.bottom - next.y) > eps) {
      failures.push(
        `row ${index} touches next by ${num(row.bottom - next.y)}px`,
      );
    }
  }
  if (
    Number.isFinite(layout.vehicleCount) &&
    Math.abs(layout.listCssHeight - layout.vehicleCount * 56) > 1
  ) {
    failures.push(
      `virtual total ${num(layout.listCssHeight)}px vs ${layout.vehicleCount} fleet rows`,
    );
  }

  // Row content is centred in the whole row and has symmetrical padding.
  for (const [index, row] of rows.entries()) {
    if (!row.content) {
      failures.push(`row ${index} has no content`);
      continue;
    }
    const rowCentre = row.y + row.height / 2;
    const contentCentre = row.content.y + row.content.height / 2;
    if (Math.abs(rowCentre - contentCentre) > eps) {
      failures.push(
        `row ${index} content centre off by ${num(contentCentre - rowCentre)}px`,
      );
    }
    if (row.content.paddingTop !== row.content.paddingBottom) {
      failures.push(
        `row ${index} content padding ${row.content.paddingTop}/${row.content.paddingBottom}`,
      );
    }
    if (row.contentJustify !== "center") {
      failures.push(`row ${index} content justify=${row.contentJustify}`);
    }
    const dividerGap = row.bottom - 1 - row.contentBottom;
    if (dividerGap < 6 - eps) {
      failures.push(`row ${index} driver line to divider ${num(dividerGap)}px`);
    }
    if (row.inlineActionHeight < 24 - eps) {
      failures.push(
        `row ${index} inline action height ${num(row.inlineActionHeight)}px`,
      );
    }
  }

  // The list starts at the header's bottom, ends at the sheet content bottom.
  if (Math.abs(layout.scroller.y - layout.header.bottom) > eps) {
    failures.push(
      `scroller top vs header bottom ${num(layout.scroller.y - layout.header.bottom)}px`,
    );
  }
  if (
    Math.abs(layout.scroller.bottom - layout.sheetBottom) >
    eps + layout.safeBottom
  ) {
    failures.push(
      `scroller bottom vs sheet bottom ${num(layout.scroller.bottom - layout.sheetBottom)}px`,
    );
  }
  if (
    layout.scroller.height >
    layout.sheet.height - layout.header.height + eps
  ) {
    failures.push(
      `scroller height ${num(layout.scroller.height)} vs sheet ${num(layout.sheet.height)} - header ${num(layout.header.height)}`,
    );
  }

  // At the end, the last row is fully visible with 12px plus safe area below.
  if (scroll === "end" && last) {
    const below = layout.scroller.bottom - last.bottom;
    const required = 12 + layout.safeBottom;
    if (below < required - 1) {
      failures.push(`space below last row ${num(below)}px < ${required}px`);
    }
  }

  // Attribution is a single 11px line, below the controls, above the sheet.
  if (layout.attributionLineCount !== 1) {
    failures.push(`attribution lines=${layout.attributionLineCount}`);
  }
  if (layout.attribution.fontSize !== "11px") {
    failures.push(`attribution font-size ${layout.attribution.fontSize}`);
  }
  if (layout.attribution.whiteSpace !== "nowrap") {
    failures.push(`attribution white-space ${layout.attribution.whiteSpace}`);
  }
  const gap = layout.attribution.y - layout.controls.bottom;
  if (gap < 8 - 1) {
    failures.push(`attribution gap below controls ${num(gap)}px`);
  }
  if (Math.abs(layout.attribution.right - layout.controls.right) > 1) {
    failures.push(
      `attribution right ${num(layout.attribution.right)} vs controls right ${num(layout.controls.right)}`,
    );
  }
  if (layout.attribution.bottom > layout.sheetTop + 1) {
    failures.push(
      `attribution bottom ${num(layout.attribution.bottom)} below sheet top ${num(layout.sheetTop)}`,
    );
  }
  const overlap = (a: Box | null, b: Box | null): boolean =>
    a !== null &&
    b !== null &&
    a.x < b.right &&
    a.right > b.x &&
    a.y < b.bottom &&
    a.bottom > b.y;
  if (overlap(layout.attribution, layout.sheet)) {
    failures.push("attribution overlaps the sheet");
  }
  if (layout.harness && overlap(layout.attribution, layout.harness)) {
    failures.push("attribution overlaps the inset harness");
  }
  if (layout.panel && overlap(layout.attribution, layout.panel)) {
    failures.push("attribution overlaps the left panel");
  }

  // Above 60% the controls hide but the credit must not.
  if (snap === "full") {
    if (Number.parseFloat(layout.controls.opacity) !== 0) {
      failures.push(`controls opacity ${layout.controls.opacity} at full`);
    }
    if (Number.parseFloat(layout.attribution.opacity) === 0) {
      failures.push("attribution hidden at full");
    }
  }

  return failures;
}

async function setSnap(page: Page, snap: Snap): Promise<void> {
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

async function setScroll(page: Page, scroll: Scroll): Promise<void> {
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
  await page.waitForTimeout(150);
}

async function waitForFleet(page: Page, count: number): Promise<void> {
  await page.getByText(new RegExp(`Showing ${count} of ${count}`)).waitFor();
  await page.getByRole("button", { name: /Showing \d+ of \d+/ }).waitFor();
  await page.waitForTimeout(250);
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
        for (const fleet of FLEETS) {
          const context = await browser.newContext({ viewport });
          await context.addInitScript((value) => {
            localStorage.setItem("fleet.theme", value as string);
          }, theme);
          const page = await context.newPage();
          await page.goto(`${BASE_URL}/map?map=fake&perf=${fleet}`);
          await page.getByRole("region", { name: "Live map" }).waitFor();
          await waitForFleet(page, fleet);
          await page.evaluate((count) => {
            const sheet = document.querySelector<HTMLElement>(
              'section[aria-label="Vehicles"]',
            );
            if (sheet) sheet.dataset.vehicleCount = String(count);
          }, fleet);

          for (const snap of SNAPS) {
            await setSnap(page, snap);
            for (const scroll of SCROLLS) {
              await setScroll(page, scroll);
              const layout = await readLayout(page);
              const label = `${theme} ${viewport.width}x${viewport.height} fleet=${fleet} ${snap} scroll=${scroll}`;
              table(label, layout);
              const failures = check(layout, snap, scroll);
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
    }
  } finally {
    await browser.close();
  }

  console.log("\n=== FAILING INVARIANTS ===");
  if (allFailures.length === 0) console.log("none");
  for (const failure of allFailures) console.log(failure);
}

void main();

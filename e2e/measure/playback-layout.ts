/**
 * Measures the playback control bar and events menu against the B11 invariants.
 *
 * Run against a mock dev server:
 *   VITE_MOCK=1 npm run dev -- --host 127.0.0.1 --port 4173
 *   node e2e/measure/playback-layout.ts
 *
 * Prints one table per viewport, theme and events state. It is a diagnostic
 * script, not a test; the assertions live in e2e/playback-layout.spec.ts.
 */
import { chromium, type Locator, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const VEHICLE = "4324a768-9b14-4223-a299-eb8da4d8d309";
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;
const EVENT_COUNTS = [1, 5, 40] as const;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  padding: string;
  margin: string;
  display: string;
  overflowY: string;
  backgroundColor: string;
  borderRadius: string;
  fontVariantNumeric: string;
  minWidth: string;
  gap: string;
  alignItems: string;
  outline: string;
  scrollHeight: number;
  clientHeight: number;
}

async function box(locator: Locator): Promise<Box | null> {
  if ((await locator.count()) === 0) return null;
  return locator.first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      x: Math.round(rect.x * 100) / 100,
      y: Math.round(rect.y * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
      right: Math.round(rect.right * 100) / 100,
      bottom: Math.round(rect.bottom * 100) / 100,
      padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
      margin: `${style.marginTop} ${style.marginRight} ${style.marginBottom} ${style.marginLeft}`,
      display: style.display,
      overflowY: style.overflowY,
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderTopLeftRadius,
      fontVariantNumeric: style.fontVariantNumeric,
      minWidth: style.minWidth,
      gap: style.gap,
      alignItems: style.alignItems,
      outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    };
  });
}

function num(value: number | undefined): string {
  return value === undefined ? "—" : String(Math.round(value * 100) / 100);
}

function tableHeader(label: string): void {
  console.log(`\n### ${label}`);
  console.log(
    [
      "element".padEnd(22),
      "x".padStart(8),
      "y".padStart(8),
      "w".padStart(8),
      "h".padStart(8),
      "bottom".padStart(8),
      "pad (t r b l)".padEnd(20),
      "display".padEnd(10),
      "gap".padEnd(8),
      "align".padEnd(10),
      "variant".padEnd(14),
      "min-w".padStart(6),
      "ov-y".padEnd(6),
      "radius",
    ].join(" "),
  );
}

function tableRow(name: string, value: Box | null): void {
  if (!value) {
    console.log(`${name.padEnd(22)} missing`);
    return;
  }
  console.log(
    [
      name.padEnd(22),
      num(value.x).padStart(8),
      num(value.y).padStart(8),
      num(value.width).padStart(8),
      num(value.height).padStart(8),
      num(value.bottom).padStart(8),
      value.padding.padEnd(20),
      value.display.padEnd(10),
      value.gap.padEnd(8),
      value.alignItems.padEnd(10),
      value.fontVariantNumeric.padEnd(14),
      value.minWidth.padStart(6),
      value.overflowY.padEnd(6),
      value.borderRadius,
    ].join(" "),
  );
}

async function gotoPlayback(page: Page, events: number): Promise<void> {
  await page.goto(`${BASE_URL}/playback?map=fake&vehicle=${VEHICLE}&events=${events}`);
  await page.getByRole("region", { name: "Playback controls" }).waitFor();
  await page.getByRole("slider", { name: "Playback position" }).waitFor();
  await page.waitForFunction(
    () => (window.__FLEET_DEBUG__?.playback?.pointCount ?? 0) > 0,
    undefined,
    { timeout: 15_000 },
  );
}

async function measureBar(page: Page): Promise<void> {
  const controls = page.getByRole("region", { name: "Playback controls" });
  const passThrough = page.getByRole("button", { name: /^(Play|Pause)$/ });
  const entries: Array<[string, Locator]> = [
    ["controls", controls],
    ["range select", page.getByLabel("Range")],
    ["resolution select", page.getByLabel("Resolution")],
    ["speed select", page.getByLabel("Playback speed", { exact: true })],
    ["transport step back", page.getByRole("button", { name: "Step back one position" })],
    ["transport play/pause", passThrough],
    ["transport step fwd", page.getByRole("button", { name: "Step forward one position" })],
    ["events trigger", page.getByRole("button", { name: /^Events \(/ })],
    ["fit route", page.getByRole("button", { name: "Fit route" })],
    [
      "scrubber root",
      page.getByRole("slider", { name: "Playback position" }).locator("xpath=../.."),
    ],
    ["scrubber track", page.getByRole("slider", { name: "Playback position" }).locator("xpath=..")],
    ["slider", page.getByRole("slider", { name: "Playback position" })],
    ["current time", page.getByTestId("playback-current-time")],
  ];
  for (const [name, locator] of entries) tableRow(name, await box(locator));
}

async function measureMenu(page: Page, events: number): Promise<void> {
  await page.getByRole("button", { name: /^Events \(/ }).click();
  const menu = page.getByRole("menu");
  await menu.waitFor();
  const items = page.getByRole("menuitem");
  const count = await items.count();
  const first = items.first();
  const last = items.last();
  tableRow("menu", await box(menu));
  tableRow("first item", await box(first));
  tableRow("last item", await box(last));
  if (count > 1) {
    const firstBox = await first.boundingBox();
    const secondBox = await items.nth(1).boundingBox();
    if (firstBox && secondBox) {
      console.log(`item gap: ${num(secondBox.y - (firstBox.y + firstBox.height))}px`);
    }
  }
  const badge = first.getByText(/^(Low|Medium|High|Critical)$/);
  if ((await badge.count()) > 0) {
    const itemBox = await first.boundingBox();
    const badgeBox = await badge.first().boundingBox();
    if (itemBox && badgeBox) {
      console.log(
        `badge right inset: ${num(itemBox.x + itemBox.width - (badgeBox.x + badgeBox.width))}px`,
      );
    }
  }
  await first.focus();
  const focused = first;
  tableRow("focused item", await box(focused));
  const menuBox = await menu.boundingBox();
  const firstBox = await first.boundingBox();
  if (menuBox && firstBox) {
    console.log(
      `item inset left: ${num(firstBox.x - menuBox.x)}px top: ${num(firstBox.y - menuBox.y)}px`,
    );
  }
  console.log(`items: ${count} (state=${events})`);
  await page.keyboard.press("Escape");
}

async function scrubberBoxes(page: Page): Promise<void> {
  const slider = page.getByRole("slider", { name: "Playback position" });
  const start = await box(slider);
  await slider.focus();
  await page.keyboard.press("End");
  await page.waitForTimeout(100);
  const end = await box(slider);
  const middleValue = await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Playback position"]');
    if (!input) return null;
    return String(Math.round((Number(input.min) + Number(input.max)) / 2));
  });
  if (middleValue) {
    await slider.fill(middleValue);
    await page.waitForTimeout(100);
  }
  const middle = await box(slider);
  if (start && middle && end) {
    console.log(
      `scrubber bbox start x=${num(start.x)} w=${num(start.width)} | middle x=${num(middle.x)} w=${num(middle.width)} | end x=${num(end.x)} w=${num(end.width)}`,
    );
  }
}

async function main(): Promise<void> {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
    args: process.env.PLAYWRIGHT_CHROMIUM_PATH ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
  });
  try {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({ viewport });
        await context.addInitScript((value) => {
          localStorage.setItem("fleet.theme", value as string);
        }, theme);
        const page = await context.newPage();
        for (const events of EVENT_COUNTS) {
          await gotoPlayback(page, events);
          const label = `${theme} ${viewport.width}x${viewport.height} events=${events}`;
          tableHeader(label);
          await measureBar(page);
          await scrubberBoxes(page);
          await measureMenu(page, events);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

void main();

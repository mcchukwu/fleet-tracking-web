/**
 * Measures every overlay-like element against the B11 layering invariants.
 *
 * Run against a mock dev server:
 *   VITE_MOCK=1 npm run dev -- --host 127.0.0.1 --port 4173
 *   node e2e/measure/layers.ts
 *
 * It prints one table per viewport, theme and interaction state: the element's
 * position, computed z-index, stacking-context ancestors and box. It is a
 * diagnostic script, not a test; the assertions live in e2e/layers.spec.ts.
 */
import { execFileSync } from "node:child_process";
import { chromium, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
] as const;
const THEMES = ["light", "dark"] as const;

type Theme = (typeof THEMES)[number];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  position: string;
  zIndex: string;
  isolation: string;
  transform: string;
  opacity: string;
  filter: string;
  willChange: string;
  ancestors: string[];
}

interface Row {
  key: string;
  box: Box;
}

const SELECTORS: Array<[string, string]> = [
  ["topbar", "header"],
  ["nav", 'nav[aria-label="Main"]'],
  ["content", '[data-testid="content-area"]'],
  ["main", "main"],
  ["banner", '[data-testid="banner-region"]'],
  ["bannerItem", '[data-testid="banner-region"] output'],
  ["map", '[data-testid="map-root"]'],
  ["kpi", '[data-testid="map-root"] .map-kpi'],
  ["panel", '[data-testid="map-root"] aside'],
  ["drawer", '[data-testid="drawer"]'],
  [
    "sheet",
    'section[aria-label="Vehicles"], [data-testid="vehicle-detail-sheet"]',
  ],
  ["footer", '[data-testid="map-footer"]'],
  ["controls", 'fieldset[aria-label="Map controls"]'],
  ["attribution", '[data-testid="map-attribution"]'],
  ["maptiler", '[data-testid="maptiler-logo"]'],
  ["dialog", '[role="dialog"]'],
  ["pickerSheet", "[data-picker-sheet]"],
  ["pickerClose", '[aria-label="Close picker"]'],
  ["menu", '[role="menu"]'],
  ["listbox", '[role="listbox"]'],
  ["tooltip", '[role="tooltip"]'],
  ["toast", '[data-layer-portal="toast"] li[data-state="open"]'],
];

async function snapshot(page: Page, keys?: readonly string[]): Promise<Row[]> {
  return page.evaluate(
    ({ selectors, only }) => {
      const stackingContext = (parent: Element): string[] => {
        const style = window.getComputedStyle(parent);
        const reasons: string[] = [];
        const z = style.zIndex;
        const positioned = style.position !== "static";
        if (positioned && z !== "auto") reasons.push(`position+z=${z}`);
        if (style.position === "fixed" || style.position === "sticky") {
          reasons.push(style.position);
        }
        if (style.opacity !== "1") reasons.push(`opacity=${style.opacity}`);
        if (style.transform !== "none") reasons.push("transform");
        if (style.filter !== "none") reasons.push("filter");
        if (style.isolation === "isolate") reasons.push("isolation");
        if (style.willChange !== "auto")
          reasons.push(`will-change=${style.willChange}`);
        if (style.backdropFilter !== "none") reasons.push("backdrop-filter");
        if (style.contain !== "none") reasons.push(`contain=${style.contain}`);
        if (style.mixBlendMode !== "normal")
          reasons.push(`blend=${style.mixBlendMode}`);
        const parentStyle = window.getComputedStyle(
          parent.parentElement ?? parent,
        );
        if (
          z !== "auto" &&
          (parentStyle.display.includes("flex") ||
            parentStyle.display.includes("grid"))
        ) {
          reasons.push(`flex-item+z=${z}`);
        }
        if (reasons.length === 0) return [];
        const id = parent.id ? `#${parent.id}` : "";
        const cls = parent.className
          ? `.${String(parent.className).trim().split(/\s+/).join(".")}`
          : "";
        return [
          `${parent.tagName.toLowerCase()}${id}${cls}[${reasons.join(",")}]`,
        ];
      };

      const rows: Array<{
        key: string;
        box: {
          x: number;
          y: number;
          width: number;
          height: number;
          right: number;
          bottom: number;
          position: string;
          zIndex: string;
          isolation: string;
          transform: string;
          opacity: string;
          filter: string;
          willChange: string;
          ancestors: string[];
        };
      }> = [];
      for (const [key, selector] of selectors) {
        if (only && !only.includes(key)) continue;
        const element = document.querySelector(selector);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const ancestors: string[] = [];
        let parent = element.parentElement;
        while (parent && parent !== document.documentElement) {
          ancestors.push(...stackingContext(parent));
          parent = parent.parentElement;
        }
        rows.push({
          key,
          box: {
            x: Math.round(rect.x * 100) / 100,
            y: Math.round(rect.y * 100) / 100,
            width: Math.round(rect.width * 100) / 100,
            height: Math.round(rect.height * 100) / 100,
            right: Math.round(rect.right * 100) / 100,
            bottom: Math.round(rect.bottom * 100) / 100,
            position: style.position,
            zIndex: style.zIndex,
            isolation: style.isolation,
            transform: style.transform === "none" ? "none" : "yes",
            opacity: style.opacity,
            filter: style.filter,
            willChange: style.willChange,
            ancestors,
          },
        });
      }
      return rows as Row[];
    },
    {
      selectors: SELECTORS,
      only: keys ?? null,
    },
  );
}

function logState(
  label: string,
  viewport: { width: number; height: number },
  theme: Theme,
  rows: Row[],
): void {
  console.log(
    `\nstate=${label} viewport=${viewport.width}x${viewport.height} theme=${theme}`,
  );
  for (const row of rows) {
    const { key, box } = row;
    console.log(
      [
        key.padEnd(12),
        `pos=${box.position}`.padEnd(14),
        `z=${box.zIndex}`.padEnd(12),
        `box=${box.x},${box.y} ${box.width}x${box.height}`.padEnd(34),
        `iso=${box.isolation}`.padEnd(10),
        box.transform === "none" ? "" : "transform",
        box.opacity !== "1" ? `opacity=${box.opacity}` : "",
        box.ancestors.length > 0 ? `ctx=[${box.ancestors.join(" > ")}]` : "",
      ]
        .filter(Boolean)
        .join("  "),
    );
  }
}

async function gotoMap(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/map?map=fake`);
  await page.getByRole("region", { name: "Live map" }).waitFor();
  await page.waitForTimeout(300);
}

async function openPanel(page: Page, width: number): Promise<void> {
  if (width >= 1024) {
    const show = page.getByRole("button", { name: "Show the vehicle panel" });
    if ((await show.count()) > 0) await show.click();
    await page.waitForTimeout(150);
    return;
  }
  const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
  if ((await handle.getAttribute("aria-expanded")) === "false")
    await handle.click();
  await page.waitForTimeout(150);
}

async function openDrawer(page: Page, width: number): Promise<void> {
  if (width < 1024) {
    const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
    await handle.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(300);
  }
  await page
    .getByRole("button", { name: /^Select / })
    .first()
    .click();
  await page.waitForTimeout(300);
}

async function openUserMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Account menu for/ }).click();
  await page.getByRole("menu").waitFor();
  await page.waitForTimeout(150);
}

async function openEditDialog(page: Page, width: number): Promise<void> {
  await openDrawer(page, width);
  if (width < 1024) {
    await page.keyboard.press("End");
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(200);
}

async function openCombobox(page: Page): Promise<void> {
  const input = page.getByRole("combobox", { name: "Driver" });
  await input.click();
  await page.getByRole("listbox").waitFor();
  await page.waitForTimeout(150);
}

async function showToast(page: Page): Promise<void> {
  await page.locator("body").click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("[");
  await page.waitForTimeout(300);
}

async function showTooltip(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Zoom in/ }).hover();
  await page.waitForTimeout(700);
}

async function measureState(
  page: Page,
  label: string,
  viewport: { width: number; height: number },
  theme: Theme,
  keys?: readonly string[],
): Promise<void> {
  const rows = await snapshot(page, keys);
  logState(label, viewport, theme, rows);
}

async function main(): Promise<void> {
  console.log("numeric z-index / z-index declarations in src:");
  try {
    const output = execFileSync(
      "rg",
      [
        "-n",
        "--no-heading",
        String.raw`\bz-(\[[^]]*\]|[0-9]+)\b|z-index\s*:`,
        "src",
      ],
      { encoding: "utf8" },
    );
    console.log(output.trim() || "  (none)");
  } catch (error) {
    console.log(`  rg failed: ${String(error)}`);
  }

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch({
    ...(executablePath
      ? { executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] }
      : {}),
  });
  try {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        await page.addInitScript((value) => {
          try {
            localStorage.setItem("fleet.theme", value);
          } catch {
            // Storage can be unavailable; the app falls back to system.
          }
        }, theme);

        await gotoMap(page);
        await openPanel(page, viewport.width);
        await measureState(page, "base", viewport, theme);

        await openDrawer(page, viewport.width);
        await measureState(page, "drawer", viewport, theme);

        await openUserMenu(page);
        await measureState(page, "user-menu", viewport, theme);
        await page.keyboard.press("Escape");

        await showTooltip(page);
        await measureState(page, "tooltip", viewport, theme);

        await showToast(page);
        await measureState(page, "toast", viewport, theme);

        await gotoMap(page);
        await openPanel(page, viewport.width);
        await openEditDialog(page, viewport.width);
        await measureState(page, "dialog", viewport, theme);
        await openCombobox(page);
        const sheetOpen =
          (await page.locator("[data-picker-sheet]").count()) > 0;
        await measureState(
          page,
          sheetOpen ? "dialog-picker-sheet" : "dialog-combobox",
          viewport,
          theme,
        );

        await context.close();

        const offline = await browser.newContext({ viewport });
        const offlinePage = await offline.newPage();
        await offlinePage.addInitScript((value) => {
          try {
            localStorage.setItem("fleet.theme", value);
          } catch {
            // Storage can be unavailable; the app falls back to system.
          }
          Object.defineProperty(navigator, "onLine", {
            configurable: true,
            get: () => false,
          });
        }, theme);
        await gotoMap(offlinePage);
        await measureState(offlinePage, "offline", viewport, theme);
        await offline.close();

        const update = await browser.newContext({ viewport });
        const updatePage = await update.newPage();
        await updatePage.addInitScript((value) => {
          try {
            localStorage.setItem("fleet.theme", value);
          } catch {
            // Storage can be unavailable; the app falls back to system.
          }
        }, theme);
        await gotoMap(updatePage);
        await updatePage.evaluate(() =>
          window.dispatchEvent(new CustomEvent("fleet:update-available")),
        );
        await updatePage.waitForTimeout(300);
        await measureState(updatePage, "update", viewport, theme);
        await update.close();
      }
    }
  } finally {
    await browser.close();
  }
}

await main();

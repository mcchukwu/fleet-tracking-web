/**
 * Measures the combobox/picker layout invariants (B11, label=combobox).
 *
 * Run against a mock dev server:
 *   VITE_MOCK=1 npm run dev -- --host 127.0.0.1 --port 4173
 *   node e2e/measure/combobox.ts
 *
 * It prints one table per viewport, theme, state and option count: boxes,
 * computed styles, icon offsets and hit tests. It is a diagnostic script; the
 * assertions live in e2e/combobox-layout.spec.ts.
 */
import { chromium, type Locator, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 412, height: 915 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
] as const;
const THEMES = ["light", "dark"] as const;
const KEYBOARD = 260;

type Theme = (typeof THEMES)[number];

const PLAYBACK_VEHICLE = "4324a768-9b14-4223-a299-eb8da4d8d309";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface IconBox {
  x: number;
  y: number;
  width: number;
  height: number;
  centerOffset: number;
}

interface ElementRow {
  role: string;
  x: number;
  y: number;
  width: number;
  height: number;
  boxSizing: string;
  overflow: string;
  position: string;
  zIndex: string;
  background: string;
  border: string;
}

interface Hit {
  label: string;
  hit: string;
  inside: boolean;
  overlap: number;
}

interface Measurement {
  state: string;
  viewport: { width: number; height: number };
  theme: Theme;
  keyboard: boolean;
  inputBefore: Box | null;
  inputAfter: Box | null;
  dialogBefore: Box | null;
  dialogAfter: Box | null;
  leading: IconBox | null;
  trailing: IconBox | null;
  list:
    | (Box & {
        position: string;
        width: number;
        maxHeight: number;
        clientHeight: number;
        scrollHeight: number;
        overflowY: string;
        gap: number;
        side: "below" | "above";
      })
    | null;
  presentation: "popover" | "sheet";
  sheet: Box | null;
  close: { hit: boolean; box: Box } | null;
  rows: { mounted: number; visible: number; height: number };
  header: Box | null;
  listWidthTarget: number | null;
  elements: ElementRow[];
  hits: Hit[];
  visualViewport: { height: number; offsetTop: number };
  scrollY: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

async function measure(
  page: Page,
  state: string,
  theme: Theme,
  inputSelector: string,
  dialogSelector: string,
): Promise<Measurement> {
  return page.evaluate(
    ({ stateName, themeName, inputSelector: inputSel, dialogSelector: dialogSel }) => {
      const rounder = (value: number) => Math.round(value * 100) / 100;
      const toBox = (rect: DOMRect) => ({
        x: rounder(rect.x),
        y: rounder(rect.y),
        width: rounder(rect.width),
        height: rounder(rect.height),
      });

      const input = inputSel ? document.querySelector<HTMLInputElement>(inputSel) : null;
      const dialog = dialogSel ? document.querySelector<HTMLElement>(dialogSel) : null;
      const list = document.querySelector<HTMLElement>('[role="listbox"]');

      const openMenu = input ? document.querySelector<HTMLElement>("[data-combobox-list]") : null;
      const resolvedList = list ?? openMenu;

      const control = input?.parentElement ?? null;
      const icons = control ? [...control.querySelectorAll("svg")] : [];
      const leading = icons[0] ?? null;
      const trailing = icons.length > 1 ? icons[icons.length - 1] : null;

      const iconBox = (element: SVGSVGElement | null) => {
        if (!element || !input) return null;
        const rect = element.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        return {
          x: rounder(rect.x),
          y: rounder(rect.y),
          width: rounder(rect.width),
          height: rounder(rect.height),
          centerOffset: rounder(rect.y + rect.height / 2 - (inputRect.y + inputRect.height / 2)),
        };
      };

      const hits: Array<{
        label: string;
        hit: string;
        inside: boolean;
        overlap: number;
      }> = [];
      if (resolvedList) {
        const listRect = resolvedList.getBoundingClientRect();
        const candidates = dialog ? [...dialog.querySelectorAll<HTMLElement>("button")] : [];
        for (const button of candidates) {
          const label =
            button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "(button)";
          if (!/^(Cancel|Close dialog)$/.test(label)) continue;
          if (button.hasAttribute("disabled")) continue;
          const rect = button.getBoundingClientRect();
          const overlap =
            Math.max(0, Math.min(listRect.right, rect.right) - Math.max(listRect.left, rect.left)) *
            Math.max(0, Math.min(listRect.bottom, rect.bottom) - Math.max(listRect.top, rect.top));
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          hits.push({
            label,
            hit: hit
              ? hit === button || button.contains(hit)
                ? "button"
                : (hit.getAttribute("aria-label") ??
                  hit.textContent?.trim().slice(0, 20) ??
                  hit.tagName)
              : "none",
            inside: hit !== null && (hit === button || button.contains(hit)),
            overlap: rounder(overlap),
          });
        }
      }

      const listRect = resolvedList?.getBoundingClientRect() ?? null;
      const inputRect = input?.getBoundingClientRect() ?? null;
      const listStyle = resolvedList ? window.getComputedStyle(resolvedList) : null;

      const describe = (role: string, element: Element | null) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          role,
          x: rounder(rect.x),
          y: rounder(rect.y),
          width: rounder(rect.width),
          height: rounder(rect.height),
          boxSizing: style.boxSizing,
          overflow: `${style.overflowX}/${style.overflowY}`,
          position: style.position,
          zIndex: style.zIndex,
          background: style.backgroundColor,
          border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
        };
      };
      const elements = [
        describe("input", input),
        describe("leading", leading),
        describe("trailing", trailing),
        describe("dialog", dialog),
        describe("list", resolvedList),
      ].filter((row): row is NonNullable<typeof row> => row !== null);

      const viewport = window.visualViewport;
      const sheetElement = document.querySelector<HTMLElement>("[data-picker-sheet]");
      const sheetRect = sheetElement?.getBoundingClientRect() ?? null;
      const closeElement = sheetElement?.querySelector<HTMLElement>('[aria-label="Close picker"]');
      const closeRect = closeElement?.getBoundingClientRect() ?? null;
      const closeHit =
        closeRect && closeElement
          ? (() => {
              const hit = document.elementFromPoint(
                closeRect.x + closeRect.width / 2,
                closeRect.y + closeRect.height / 2,
              );
              return hit !== null && closeElement.contains(hit);
            })()
          : false;
      const header = sheetElement?.querySelector<HTMLElement>("[data-picker-sheet] > div");
      const options = resolvedList
        ? [...resolvedList.querySelectorAll<HTMLElement>('[role="option"]')]
        : [];
      const listBox = resolvedList?.getBoundingClientRect() ?? null;
      const visibleRows = listBox
        ? options.filter((option) => {
            const rect = option.getBoundingClientRect();
            return rect.top >= listBox.top - 1 && rect.bottom <= listBox.bottom + 1;
          }).length
        : 0;

      return {
        presentation: sheetElement ? "sheet" : "popover",
        sheet: sheetRect
          ? {
              x: rounder(sheetRect.x),
              y: rounder(sheetRect.y),
              width: rounder(sheetRect.width),
              height: rounder(sheetRect.height),
            }
          : null,
        close:
          closeRect !== null
            ? {
                hit: closeHit,
                box: {
                  x: rounder(closeRect.x),
                  y: rounder(closeRect.y),
                  width: rounder(closeRect.width),
                  height: rounder(closeRect.height),
                },
              }
            : null,
        rows: {
          mounted: options.length,
          visible: visibleRows,
          height: rounder(options[0]?.getBoundingClientRect().height ?? 0),
        },
        header: header
          ? {
              x: rounder(header.getBoundingClientRect().x),
              y: rounder(header.getBoundingClientRect().y),
              width: rounder(header.getBoundingClientRect().width),
              height: rounder(header.getBoundingClientRect().height),
            }
          : null,
        state: stateName,
        theme: themeName as "light" | "dark",
        viewport: { width: window.innerWidth, height: window.innerHeight },
        keyboard: false,
        inputBefore: null,
        inputAfter: inputRect ? toBox(inputRect) : null,
        dialogBefore: null,
        dialogAfter: dialog ? toBox(dialog.getBoundingClientRect()) : null,
        leading: iconBox(leading),
        trailing: iconBox(trailing),
        list:
          listRect && listStyle
            ? {
                ...toBox(listRect),
                position: listStyle.position,
                width: rounder(listRect.width),
                maxHeight: Number.parseFloat(listStyle.maxHeight) || 0,
                clientHeight: resolvedList?.clientHeight ?? 0,
                scrollHeight: resolvedList?.scrollHeight ?? 0,
                overflowY: listStyle.overflowY,
                gap:
                  inputRect && listRect
                    ? rounder(
                        listRect.top >= inputRect.bottom
                          ? listRect.top - inputRect.bottom
                          : inputRect.top - listRect.bottom,
                      )
                    : 0,
                side: inputRect && listRect && listRect.top >= inputRect.bottom ? "below" : "above",
              }
            : null,
        listWidthTarget: inputRect ? rounder(inputRect.width) : null,
        elements,
        hits,
        visualViewport: {
          height: viewport?.height ?? window.innerHeight,
          offsetTop: viewport?.offsetTop ?? 0,
        },
        scrollY: window.scrollY,
      };
    },
    {
      stateName: state,
      themeName: theme,
      inputSelector,
      dialogSelector,
    },
  );
}

function log(measurement: Measurement, failures: string[]): void {
  const { state, viewport, theme } = measurement;
  console.log(
    `\nstate=${state} viewport=${viewport.width}x${viewport.height} theme=${theme} keyboard=${measurement.keyboard} vv=${measurement.visualViewport.height}@${measurement.visualViewport.offsetTop} scrollY=${measurement.scrollY}`,
  );
  console.log(
    `  ${"element".padEnd(9)} ${"x,y".padEnd(16)} ${"w x h".padEnd(18)} ${"box".padEnd(11)} ${"overflow".padEnd(14)} ${"position".padEnd(9)} ${"z".padEnd(5)} ${"background".padEnd(22)} border`,
  );
  for (const row of measurement.elements) {
    console.log(
      `  ${row.role.padEnd(9)} ${`${row.x},${row.y}`.padEnd(16)} ${`${row.width} x ${row.height}`.padEnd(18)} ${row.boxSizing.padEnd(11)} ${row.overflow.padEnd(14)} ${row.position.padEnd(9)} ${row.zIndex.padEnd(5)} ${row.background.padEnd(22)} ${row.border}`,
    );
  }
  if (measurement.leading || measurement.trailing) {
    console.log(
      `  icons  leading.centre=${measurement.leading?.centerOffset ?? "-"} trailing.centre=${measurement.trailing?.centerOffset ?? "-"}`,
    );
  }
  console.log(
    `  picker presentation=${measurement.presentation} rows mounted=${measurement.rows.mounted} visible=${measurement.rows.visible} rowH=${measurement.rows.height}`,
  );
  if (measurement.sheet) {
    console.log(
      `  sheet  ${measurement.sheet.x},${measurement.sheet.y} ${measurement.sheet.width}x${measurement.sheet.height} headerH=${measurement.header?.height ?? "-"} closeHit=${measurement.close?.hit ?? "-"}`,
    );
  }
  if (measurement.list) {
    const list = measurement.list;
    console.log(
      `  list   side=${list.side} gap=${list.gap} maxH=${list.maxHeight} clientH=${list.clientHeight} scrollH=${list.scrollHeight}`,
    );
  } else {
    console.log("  list   (not open)");
  }
  for (const hit of measurement.hits) {
    console.log(
      `  hit    ${hit.label.padEnd(13)} -> ${hit.hit.padEnd(13)} inside=${hit.inside} overlap=${hit.overlap}px²`,
    );
  }
  for (const failure of failures) console.log(`  FAIL   ${failure}`);
}

function failuresFor(measurement: Measurement): string[] {
  const failures: string[] = [];
  for (const [name, icon] of [
    ["leading", measurement.leading],
    ["trailing", measurement.trailing],
  ] as const) {
    if (icon && Math.abs(icon.centerOffset) > 0.5) {
      failures.push(`${name} icon centre is ${icon.centerOffset}px from the input centre`);
    }
  }
  if (
    measurement.inputBefore &&
    measurement.inputAfter &&
    (measurement.inputBefore.x !== measurement.inputAfter.x ||
      measurement.inputBefore.y !== measurement.inputAfter.y ||
      measurement.inputBefore.width !== measurement.inputAfter.width ||
      measurement.inputBefore.height !== measurement.inputAfter.height)
  ) {
    failures.push(
      `input moved: ${JSON.stringify(measurement.inputBefore)} -> ${JSON.stringify(measurement.inputAfter)}`,
    );
  }
  if (
    measurement.dialogBefore &&
    measurement.dialogAfter &&
    (measurement.dialogBefore.x !== measurement.dialogAfter.x ||
      measurement.dialogBefore.y !== measurement.dialogAfter.y ||
      measurement.dialogBefore.width !== measurement.dialogAfter.width ||
      measurement.dialogBefore.height !== measurement.dialogAfter.height)
  ) {
    failures.push(
      `dialog moved: ${JSON.stringify(measurement.dialogBefore)} -> ${JSON.stringify(measurement.dialogAfter)}`,
    );
  }
  if (measurement.presentation === "sheet") {
    const sheet = measurement.sheet;
    const visibleTop = measurement.visualViewport.offsetTop;
    const visibleBottom = visibleTop + measurement.visualViewport.height;
    if (!sheet) failures.push("the sheet has no box");
    if (sheet && sheet.y < visibleTop - 0.5) {
      failures.push("the sheet top is above the visual viewport");
    }
    if (sheet && sheet.y + sheet.height > visibleBottom + 0.5) {
      failures.push("the sheet bottom is below the visual viewport");
    }
    if (!measurement.close?.hit) {
      failures.push("the sheet close is not hit-testable");
    }
    if (Math.abs(measurement.rows.height - 56) > 0.5) {
      failures.push(`sheet row height is ${measurement.rows.height}px, not 56px`);
    }
    if (measurement.rows.mounted >= 4 && measurement.rows.visible < 4) {
      failures.push(`only ${measurement.rows.visible} rows are visible`);
    }
  } else if (measurement.list) {
    if (Math.abs(measurement.rows.height - 44) > 0.5) {
      failures.push(`popover row height is ${measurement.rows.height}px, not 44px`);
    }
    if (measurement.listWidthTarget !== null) {
      const expected = Math.max(
        240,
        Math.min(measurement.listWidthTarget, measurement.viewport.width - 16),
      );
      if (Math.abs(measurement.list.width - expected) > 0.5) {
        failures.push(`list width ${measurement.list.width}px, expected ${expected}px`);
      }
    }
    if (measurement.list.position !== "fixed") {
      failures.push(`list position is ${measurement.list.position}, not fixed`);
    }
    const visibleBottom = measurement.visualViewport.offsetTop + measurement.visualViewport.height;
    if (measurement.list.y + measurement.list.height > visibleBottom + 0.5) {
      failures.push(
        `list bottom ${round(measurement.list.y + measurement.list.height)} is below the visual viewport ${visibleBottom}`,
      );
    }
    if (measurement.list.y < measurement.visualViewport.offsetTop - 0.5) {
      failures.push(
        `list top ${measurement.list.y} is above the visual viewport ${measurement.visualViewport.offsetTop}`,
      );
    }
    if (
      measurement.list.scrollHeight > measurement.list.clientHeight &&
      !["auto", "scroll"].includes(measurement.list.overflowY)
    ) {
      failures.push("the list overflows without scrolling inside itself");
    }
  }
  if (measurement.presentation === "popover")
    for (const hit of measurement.hits) {
      if (!hit.inside) {
        failures.push(`${hit.label} is not hit-testable: ${hit.hit}`);
      }
      if (hit.overlap > 0) {
        failures.push(`${hit.label} overlaps the list by ${hit.overlap}px²`);
      }
    }
  return failures;
}

async function gotoLab(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/dev/combobox`);
  await page.getByRole("heading", { name: "Combobox lab" }).waitFor();
}

async function gotoMap(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/map?map=fake`);
  await page.getByRole("region", { name: "Live map" }).waitFor();
  await page.waitForTimeout(300);
}

async function openDrawer(page: Page, width: number): Promise<void> {
  if (width < 1024) {
    const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
    await handle.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: "Select LSD-100-AA" }).click();
  await page.waitForTimeout(300);
  if (width < 1024) {
    await page.keyboard.press("End");
    await page.waitForTimeout(300);
  }
}

async function gotoPlayback(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/playback?map=fake&vehicle=${PLAYBACK_VEHICLE}`);
  await page.getByRole("region", { name: "Playback controls" }).waitFor({ timeout: 15_000 });
}

async function revealInVisualViewport(page: Page, selector: string): Promise<void> {
  await page.evaluate((inputSelector) => {
    const viewport = window.visualViewport as (VisualViewport & { offsetTop: number }) | null;
    const fake = (
      window as unknown as {
        __FAKE_VV__?: { offsetTop: number; height: number };
      }
    ).__FAKE_VV__;
    const input = inputSelector ? document.querySelector<HTMLElement>(inputSelector) : null;
    if (!viewport || !fake || !input) return;
    const rect = input.getBoundingClientRect();
    let offset = fake.offsetTop;
    if (rect.bottom > offset + fake.height - 8) {
      offset = rect.bottom - fake.height + 8;
    }
    if (rect.top < offset + 8) offset = Math.max(0, rect.top - 8);
    if (offset === fake.offsetTop) return;
    fake.offsetTop = offset;
    viewport.dispatchEvent(new Event("resize"));
  }, selector);
}

async function measureBeforeAfter(
  page: Page,
  state: string,
  theme: Theme,
  viewport: { width: number; height: number },
  keyboard: boolean,
  input: Locator,
  inputSelector: string,
  dialogSelector: string,
): Promise<void> {
  await input.scrollIntoViewIfNeeded();
  await revealInVisualViewport(page, inputSelector);
  const before = await page.evaluate(
    ({ inputSel, dialogSel }) => {
      const rounder = (value: number) => Math.round(value * 100) / 100;
      const toBox = (rect: DOMRect) => ({
        x: rounder(rect.x),
        y: rounder(rect.y),
        width: rounder(rect.width),
        height: rounder(rect.height),
      });
      const inputElement = inputSel ? document.querySelector<HTMLElement>(inputSel) : null;
      const dialogElement = dialogSel ? document.querySelector<HTMLElement>(dialogSel) : null;
      return {
        input: inputElement ? toBox(inputElement.getBoundingClientRect()) : null,
        dialog: dialogElement ? toBox(dialogElement.getBoundingClientRect()) : null,
      };
    },
    { inputSel: inputSelector, dialogSel: dialogSelector },
  );
  await input.click();
  await page.locator("[data-combobox-list]").waitFor();
  await page.waitForTimeout(150);
  const measurement = await measure(page, state, theme, inputSelector, dialogSelector);
  measurement.inputBefore = before.input;
  measurement.dialogBefore = before.dialog;
  measurement.viewport = viewport;
  measurement.keyboard = keyboard;
  const failures = failuresFor(measurement);
  log(measurement, failures);
}

async function emulateKeyboard(page: Page): Promise<void> {
  await page.evaluate((keyboard) => {
    const real = window.visualViewport;
    const listeners: Array<(event: Event) => void> = [];
    const fake = {
      width: real?.width ?? window.innerWidth,
      height: window.innerHeight - keyboard,
      offsetTop: 0,
      offsetLeft: 0,
      pageTop: 0,
      pageLeft: 0,
      scale: 1,
      addEventListener: (type: string, listener: EventListener) => {
        if (type === "resize" || type === "scroll") listeners.push(listener);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        if (type !== "resize" && type !== "scroll") return;
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      },
      dispatchEvent: (event: Event) => {
        for (const listener of listeners) listener(event);
        return true;
      },
    };
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: fake,
    });
    Object.defineProperty(window, "__FAKE_VV__", {
      configurable: true,
      value: fake,
    });
    fake.dispatchEvent(new Event("resize"));
  }, KEYBOARD);
  await page.waitForTimeout(100);
}

async function main(): Promise<void> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch({
    ...(executablePath
      ? { executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] }
      : {}),
  });
  try {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        for (const keyboard of viewport.width < 768 ? [false, true] : [false]) {
          const context = await browser.newContext({ viewport });
          const page = await context.newPage();
          await page.addInitScript((value) => {
            try {
              localStorage.setItem("fleet.theme", value);
            } catch {
              // Storage can be unavailable; the app falls back to system.
            }
          }, theme);

          await gotoLab(page);
          if (keyboard) await emulateKeyboard(page);
          for (const count of [3, 4, 25, 500] as const) {
            await measureBeforeAfter(
              page,
              `lab-standalone-${count}`,
              theme,
              viewport,
              keyboard,
              page.getByRole("combobox", {
                name: `Vehicle (${count} options)`,
              }),
              `[aria-label="${count} options"] input`,
              "",
            );
            await page.keyboard.press("Escape");
            await page.getByRole("button", { name: `Open ${count}-option dialog` }).click();
            await page.getByRole("dialog").waitFor();
            await measureBeforeAfter(
              page,
              `lab-dialog-${count}`,
              theme,
              viewport,
              keyboard,
              page.getByRole("combobox", { name: "Vehicle" }),
              '[role="dialog"] [role="combobox"]',
              '[role="dialog"]',
            );
            await page.keyboard.press("Escape");
            await page.keyboard.press("Escape");
            await page.getByRole("dialog").waitFor({ state: "hidden" });
          }

          await gotoPlayback(page);
          if (keyboard) await emulateKeyboard(page);
          await page.getByRole("button", { name: "Change vehicle" }).click();
          await page.getByRole("dialog", { name: "Change vehicle" }).waitFor();
          await measureBeforeAfter(
            page,
            "playback-change-vehicle",
            theme,
            viewport,
            keyboard,
            page.getByRole("combobox", { name: "Vehicle" }),
            '[role="dialog"] [role="combobox"]',
            '[role="dialog"]',
          );

          await gotoMap(page);
          if (keyboard) await emulateKeyboard(page);
          await openDrawer(page, viewport.width);
          await page.getByRole("button", { name: "Assign driver" }).click();
          await page.getByRole("dialog").waitFor();
          await measureBeforeAfter(
            page,
            "drawer-assign-driver",
            theme,
            viewport,
            keyboard,
            page.getByRole("combobox", { name: "Driver" }),
            '[role="dialog"] [role="combobox"]',
            '[role="dialog"]',
          );
          await page.getByRole("button", { name: "Cancel" }).click();
          await page.getByRole("dialog").waitFor({ state: "hidden" });

          await page.getByRole("button", { name: "Edit", exact: true }).first().click();
          await page.getByRole("dialog").waitFor();
          await measureBeforeAfter(
            page,
            "drawer-edit",
            theme,
            viewport,
            keyboard,
            page.getByRole("combobox", { name: "Driver" }),
            '[role="dialog"] [role="combobox"]',
            '[role="dialog"]',
          );

          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

await main();

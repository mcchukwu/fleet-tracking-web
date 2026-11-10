/**
 * Measures the playback options and control bar against the B11 invariants for
 * the playback-mobile-layout fix.
 *
 * Run against a mock dev server:
 *   VITE_MOCK=1 npm run dev -- --host 127.0.0.1 --port 4173
 *   PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium node e2e/measure/playback-mobile-layout.ts
 *
 * It prints one table per viewport, theme, event count and label length, plus
 * every invariant that fails and by how many px. It is a diagnostic script;
 * the assertions live in e2e/playback-mobile-layout.spec.ts.
 */
import { chromium, type Locator, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const VEHICLE = "4324a768-9b14-4223-a299-eb8da4d8d309";
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const THEMES = ["light", "dark"] as const;
const EVENT_COUNTS = [0, 5, 40] as const;
const LABELS = ["normal", "long"] as const;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  padding: string;
  display: string;
  overflow: string;
  position: string;
  zIndex: string;
  backgroundColor: string;
  border: string;
  boxSizing: string;
  fontSize: string;
  textOverflow: string;
  whiteSpace: string;
  gap: string;
  minWidth: string;
  scrollWidth: number;
  clientWidth: number;
}

async function box(locator: Locator): Promise<Box | null> {
  if ((await locator.count()) === 0) return null;
  return locator.first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
      padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
      display: style.display,
      overflow: `${style.overflowX}/${style.overflowY}`,
      position: style.position,
      zIndex: style.zIndex,
      backgroundColor: style.backgroundColor,
      border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
      boxSizing: style.boxSizing,
      fontSize: style.fontSize,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
      gap: style.gap,
      minWidth: style.minWidth,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    };
  });
}

function num(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : String(Math.round(value * 100) / 100);
}

function row(name: string, value: Box | null): void {
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
      num(value.right).padStart(8),
      num(value.bottom).padStart(8),
      value.padding.padEnd(18),
      value.display.padEnd(8),
      value.overflow.padEnd(12),
      value.position.padEnd(8),
      value.zIndex.padStart(4),
      value.boxSizing.padEnd(9),
      value.gap.padEnd(6),
      value.minWidth.padEnd(7),
      value.textOverflow.padEnd(8),
      value.whiteSpace.padEnd(10),
    ].join(" "),
  );
}

function fail(message: string): void {
  console.log(`FAIL ${message}`);
}

async function gotoPlayback(
  page: Page,
  events: number,
  labels: "normal" | "long",
): Promise<void> {
  const labelsParam = labels === "long" ? "&labels=long" : "";
  await page.goto(
    `${BASE_URL}/playback?map=fake&vehicle=${VEHICLE}&events=${events}${labelsParam}`,
  );
  await page.getByRole("region", { name: "Playback map" }).waitFor();
  await page.waitForFunction(
    () => (window.__FLEET_DEBUG__?.playback?.pointCount ?? 0) > 0,
    undefined,
    { timeout: 15_000 },
  );
}

async function measure(page: Page, events: number, labels: "normal" | "long"): Promise<void> {
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const mobile = viewport.width < 768;
  console.log(`\n### ${page.viewportSize()?.width}px events=${events} labels=${labels}`);

  const documentBox = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  row("document", {
    x: 0,
    y: 0,
    width: documentBox.innerWidth,
    height: 0,
    right: documentBox.scrollWidth,
    bottom: 0,
    padding: "",
    display: "",
    overflow: "",
    position: "",
    zIndex: "",
    backgroundColor: "",
    border: "",
    boxSizing: "",
    fontSize: "",
    textOverflow: "",
    whiteSpace: "",
    gap: "",
    minWidth: "",
    scrollWidth: 0,
    clientWidth: 0,
  });
  if (documentBox.scrollWidth > documentBox.innerWidth) {
    fail(
      `document scrollWidth ${documentBox.scrollWidth} > innerWidth ${documentBox.innerWidth} by ${documentBox.scrollWidth - documentBox.innerWidth}px`,
    );
  }

  const options =
    (await page.locator('[data-testid="playback-options"]').count()) > 0
      ? page.getByTestId("playback-options")
      : page.locator('[data-testid="playback-page"] header');
  const vehicle = page.getByRole("button", { name: "Change vehicle" });
  const range = page.getByLabel("Range");
  const eventsButton = page.getByRole("button", { name: /^Events \(/ });
  const fit = page.getByRole("button", { name: "Fit route" });
  const info = page.getByTestId("playback-options-info");
  const controls = page.getByRole("region", { name: "Playback controls" });
  const transport = page.getByRole("group", { name: "Transport" });
  const speed = page.getByLabel("Playback speed", { exact: true });
  const scrubber = page.getByTestId("playback-scrubber");
  const lane = page.getByTestId("playback-event-band");
  const current = page.getByTestId("playback-current-time");
  const readout = page.getByTestId("playback-readout");

  const optionsBox = await box(options);
  const vehicleBox = await box(vehicle);
  const rangeBox = await box(range);
  const eventsBox = await box(eventsButton);
  const fitBox = await box(fit);
  const infoBox = await box(info);
  const controlsBox = await box(controls);
  const transportBox = await box(transport);
  const speedBox = await box(speed);
  const scrubberBox = await box(scrubber);
  const laneBox = await box(lane);
  const currentBox = await box(current);
  const readoutBox = await box(readout);

  for (const [name, value] of [
    ["options", optionsBox],
    ["vehicle trigger", vehicleBox],
    ["range trigger", rangeBox],
    ["events", eventsBox],
    ["fit route", fitBox],
    ["info line", infoBox],
    ["controls", controlsBox],
    ["transport", transportBox],
    ["speed", speedBox],
    ["scrubber", scrubberBox],
    ["event lane", laneBox],
    ["current time", currentBox],
    ["readout", readoutBox],
  ] as const) {
    row(name, value);
  }

  if (events > 0) {
    await eventsButton.click();
    const menu = page.getByRole("menu");
    await menu.waitFor();
    row("menu", await box(menu));
    row("first item", await box(page.getByRole("menuitem").first()));
    const menuBox = await box(menu);
    if (menuBox) {
      if (menuBox.right > viewport.width - 12 + 0.5) {
        fail(`menu right ${num(menuBox.right)} is outside the 12px inset`);
      }
      if (menuBox.x < 12 - 0.5) fail(`menu left ${num(menuBox.x)} is outside the 12px inset`);
      const expected = Math.min(320, viewport.width - 24);
      if (Math.abs(menuBox.width - expected) > 1) {
        fail(`menu width ${num(menuBox.width)} != min(320, ${viewport.width - 24})`);
      }
      if (eventsBox) {
        const anchored =
          menuBox.x <= eventsBox.right + 1 && menuBox.right >= eventsBox.x - 1;
        if (!anchored) fail("menu is not anchored to its trigger");
      }
    }
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "hidden" });
  }

  if (optionsBox && vehicleBox && rangeBox && eventsBox && fitBox) {
    if (Math.abs(fitBox.x - eventsBox.right - 8) > 0.5) {
      fail(`events and fit route gap ${num(fitBox.x - eventsBox.right)} != 8`);
    }
    if (Math.abs(fitBox.right - (viewport.width - 12)) > 0.5) {
      fail(`fit route right inset ${num(viewport.width - fitBox.right)} != 12`);
    }
    if (vehicleBox.right > eventsBox.x + 0.5) {
      fail("vehicle trigger overlaps the tools cluster");
    }
    if (rangeBox.right > eventsBox.x + 0.5) {
      fail("range trigger overlaps the tools cluster");
    }
    const toolsTop = Math.min(eventsBox.y, fitBox.y);
    if (Math.abs(eventsBox.y - fitBox.y) > 0.5) fail("tools are not on one line");
    if (vehicleBox.y < optionsBox.y - 0.5 || vehicleBox.y > toolsTop + 0.5) {
      fail("vehicle trigger is not in the first options row");
    }
    if (infoBox && Math.abs(infoBox.y - Math.max(vehicleBox.bottom, eventsBox.bottom)) > 16) {
      fail("info line is not directly under the first options row");
    }
    if (infoBox && infoBox.scrollWidth > infoBox.width + 1) {
      console.log(
        `info line truncates: scrollWidth ${infoBox.scrollWidth} > width ${num(infoBox.width)}`,
      );
    }
  }

  if (vehicleBox && rangeBox && eventsBox && fitBox) {
    for (const [name, value] of [
      ["vehicle", vehicleBox],
      ["range", rangeBox],
      ["events", eventsBox],
      ["fit", fitBox],
    ] as const) {
      const minimum = mobile ? 44 : 32;
      if (value.height < minimum - 0.5) {
        fail(`${name} height ${num(value.height)} < ${minimum}`);
      }
      if (value.right > viewport.width - 12 + 0.5) {
        fail(`${name} right ${num(value.right)} is outside the 12px inset`);
      }
    }
    if (Math.abs(vehicleBox.height - rangeBox.height) > 0.5) {
      fail("vehicle and range triggers have different heights");
    }
    if (Math.abs(vehicleBox.bottom - rangeBox.bottom) > 0.5) {
      fail("vehicle and range triggers have different bottom edges");
    }
  }

  if (controlsBox && scrubberBox && laneBox && currentBox) {
    if (mobile) {
      if (scrubberBox.x < 11.5 || scrubberBox.x > 12.5) {
        fail(`scrubber left ${num(scrubberBox.x)} != 12`);
      }
      if (Math.abs(scrubberBox.right - (viewport.width - 12)) > 0.5) {
        fail(`scrubber right inset ${num(viewport.width - scrubberBox.right)} != 12`);
      }
      if (transportBox && speedBox) {
        const groupX = transportBox.x;
        const groupRight = speedBox.right;
        const centre = (groupX + groupRight) / 2;
        if (Math.abs(centre - (viewport.width / 2)) > 1) {
          fail(`row two centre ${num(centre)} != ${num(viewport.width / 2)}`);
        }
        if (Math.abs(speedBox.x - transportBox.right - 16) > 0.5) {
          fail(`transport to speed gap ${num(speedBox.x - transportBox.right)} != 16`);
        }
        if (Math.abs(transportBox.bottom - speedBox.bottom) > 0.5) {
          fail("row two bottoms differ");
        }
        if (transportBox.y < scrubberBox.bottom - 0.5) {
          fail("row two is not under the scrubber");
        }
      }
    } else {
      const items = [
        transportBox,
        readoutBox,
        scrubberBox,
        speedBox,
      ].filter((value): value is Box => value !== null);
      const bottom = items[0]?.bottom ?? 0;
      for (const item of items) {
        if (Math.abs(item.bottom - bottom) > 0.5) fail("single row bottoms differ");
      }
      if (readoutBox && transportBox && (readoutBox.x < transportBox.right - 0.5 || readoutBox.right > scrubberBox.x + 0.5)) {
        fail("readout is not between transport and the scrubber");
      }
    }
    if (laneBox.height < (mobile ? 44 : 28) - 0.5) {
      fail(`event lane height ${num(laneBox.height)} < ${mobile ? 44 : 28}`);
    }
    if (currentBox.minWidth === "0px") fail("current time has no min-width");
  }

  if (mobile) {
    const top = optionsBox?.bottom ?? 0;
    const bottom = controlsBox?.y ?? viewport.height;
    const visible = bottom - top;
    console.log(`map gap ${num(visible)}px (${num((visible / viewport.height) * 100)}% of viewport)`);
    if (viewport.width === 360 && viewport.height === 640 && visible < viewport.height * 0.4) {
      fail(`visible map ${num(visible)} < 40% of 640`);
    }
  }
}

async function main(): Promise<void> {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
    args: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? ["--no-sandbox", "--disable-dev-shm-usage"]
      : [],
  });
  try {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({ viewport });
        await context.addInitScript((value) => {
          localStorage.setItem("fleet.theme", value as string);
        }, theme);
        const page = await context.newPage();
        for (const labels of LABELS) {
          for (const events of EVENT_COUNTS) {
            console.log(`\n== ${theme} ${viewport.width}x${viewport.height} events=${events} labels=${labels}`);
            await gotoPlayback(page, events, labels);
            await measure(page, events, labels);
          }
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

void main();

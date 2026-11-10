import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  emulateSoftwareKeyboard,
  expectNoHorizontalScroll,
  revealInVisualViewport,
} from "./helpers";

/**
 * The picker overlay across 1440x900, 390x844 and 360x640, light and dark, with
 * 3, 25 and 500 options and the software keyboard open. The dev combobox page
 * makes the option count deterministic; the assertions are measurements.
 */

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
] as const;
const COUNTS = [3, 25, 500] as const;
const KEYBOARD = 260;
const TOLERANCE = 0.75;

interface OverlayMeasurement {
  list: {
    x: number;
    y: number;
    width: number;
    height: number;
    bottom: number;
    position: string;
    overflowY: string;
    maxHeight: number;
    clientHeight: number;
    scrollHeight: number;
    portalled: boolean;
    side: "below" | "above";
    gap: number;
  };
  hits: Array<{ label: string; inside: boolean; overlap: number }>;
  viewport: { width: number; height: number };
  visualViewport: { width: number; height: number; offsetTop: number };
  scrollY: number;
}

async function measureOverlay(input: Locator): Promise<OverlayMeasurement> {
  return input.evaluate((element) => {
    const round = (value: number) => Math.round(value * 100) / 100;
    const inputRect = element.getBoundingClientRect();
    const scope = element.closest<HTMLElement>('[role="dialog"]');
    const list = document.querySelector<HTMLElement>("[data-combobox-list]");
    const listRect = list?.getBoundingClientRect() ?? null;
    const style = list ? window.getComputedStyle(list) : null;

    const hits: Array<{
      label: string;
      inside: boolean;
      overlap: number;
    }> = [];
    if (scope && listRect) {
      for (const button of scope.querySelectorAll<HTMLElement>("button")) {
        const label =
          button.getAttribute("aria-label") ??
          button.textContent?.trim() ??
          "(button)";
        if (!/^(Cancel|Close dialog)$/.test(label)) continue;
        if (button.hasAttribute("disabled")) continue;
        const buttonRect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(
          buttonRect.x + buttonRect.width / 2,
          buttonRect.y + buttonRect.height / 2,
        );
        hits.push({
          label,
          inside: hit !== null && (hit === button || button.contains(hit)),
          overlap: round(
            Math.max(
              0,
              Math.min(listRect.right, buttonRect.right) -
                Math.max(listRect.left, buttonRect.left),
            ) *
              Math.max(
                0,
                Math.min(listRect.bottom, buttonRect.bottom) -
                  Math.max(listRect.top, buttonRect.top),
              ),
          ),
        });
      }
    }

    const viewport = window.visualViewport;
    return {
      list: {
        x: round(listRect?.x ?? 0),
        y: round(listRect?.y ?? 0),
        width: round(listRect?.width ?? 0),
        height: round(listRect?.height ?? 0),
        bottom: round(listRect?.bottom ?? 0),
        position: style?.position ?? "",
        overflowY: style?.overflowY ?? "",
        maxHeight: Number.parseFloat(style?.maxHeight ?? "0") || 0,
        clientHeight: list?.clientHeight ?? 0,
        scrollHeight: list?.scrollHeight ?? 0,
        portalled: list?.closest('[data-layer-portal="popover"]') !== null,
        side:
          listRect && listRect.top >= inputRect.bottom
            ? ("below" as const)
            : ("above" as const),
        gap: listRect
          ? listRect.top >= inputRect.bottom
            ? round(listRect.top - inputRect.bottom)
            : round(inputRect.top - listRect.bottom)
          : 0,
      },
      hits,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      visualViewport: {
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
        offsetTop: viewport?.offsetTop ?? 0,
      },
      scrollY: window.scrollY,
    };
  });
}

async function measureBefore(input: Locator) {
  return input.evaluate((element) => {
    const scope = element.closest<HTMLElement>('[role="dialog"]');
    const round = (value: number) => Math.round(value * 100) / 100;
    const toBox = (value: DOMRect) => ({
      x: round(value.x),
      y: round(value.y),
      width: round(value.width),
      height: round(value.height),
    });
    return {
      input: toBox(element.getBoundingClientRect()),
      dialog: scope ? toBox(scope.getBoundingClientRect()) : null,
    };
  });
}

function expectStable(
  before: { x: number; y: number; width: number; height: number } | null,
  after: { x: number; y: number; width: number; height: number },
  label: string,
): void {
  expect(before).not.toBeNull();
  for (const key of ["x", "y", "width", "height"] as const) {
    expect(
      Math.abs((before?.[key] ?? 0) - after[key]),
      `${label} ${key} is stable when the list opens`,
    ).toBeLessThanOrEqual(TOLERANCE);
  }
}

async function expectOverlayFits(
  page: Page,
  input: Locator,
): Promise<{ measured: OverlayMeasurement; after: { x: number; y: number; width: number; height: number } }> {
  await input.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const before = await measureBefore(input);
  await input.click();
  await expect(page.locator("[data-combobox-list]")).toBeVisible();
  const measured = await measureOverlay(input);
  const after = await measureBefore(input);
  expectStable(before.input, after.input, "the input");
  if (before.dialog) {
    expectStable(before.dialog, after.dialog ?? before.dialog, "the dialog");
  }

  const list = measured.list;
  expect(list.position).toBe("fixed");
  expect(list.portalled, "the list renders in the popover layer").toBe(true);
  expect(["auto", "scroll"]).toContain(list.overflowY);
  expect(list.width).toBeCloseTo(
    Math.max(240, Math.min(after.input.width, measured.viewport.width - 16)),
    1,
  );
  expect(list.gap).toBeCloseTo(4, 1);

  const visibleTop = measured.visualViewport.offsetTop;
  const visibleBottom = visibleTop + measured.visualViewport.height;
  expect(list.y).toBeGreaterThanOrEqual(visibleTop - TOLERANCE);
  expect(list.bottom).toBeLessThanOrEqual(visibleBottom + TOLERANCE);
  expect(list.maxHeight).toBeLessThanOrEqual(
    visibleBottom - visibleTop + TOLERANCE,
  );
  expect(measured.scrollY, "opening the list did not scroll the page").toBe(
    scrollBefore,
  );

  return { measured, after: after.input };
}

async function openLab(page: Page): Promise<void> {
  await page.goto("/dev/combobox");
  await expect(
    page.getByRole("heading", { name: "Combobox lab" }),
  ).toBeVisible();
}

test.describe(
  "picker overlay across viewports, themes and option counts",
  { tag: "@theme" },
  () => {
    for (const viewport of VIEWPORTS) {
      test(`standalone picker keeps its box at ${viewport.width}x${viewport.height}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await openLab(page);

        for (const keyboard of viewport.width < 768 ? [false, true] : [false]) {
          if (keyboard) await emulateSoftwareKeyboard(page, KEYBOARD);
          for (const count of COUNTS) {
            const input = page.getByRole("combobox", {
              name: `Vehicle (${count} options)`,
            });
            await revealInVisualViewport(input);
            const { measured } = await expectOverlayFits(page, input);
            expect(
              measured.list.scrollHeight >= measured.list.clientHeight,
            ).toBe(true);
            expect(measured.list.maxHeight).toBeLessThanOrEqual(256);
            await expect(input).toBeFocused();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-combobox-list]")).toBeHidden();
            await captureForReview(
              page,
              `combobox-standalone-${count}${keyboard ? "-keyboard" : ""}-${viewport.width}`,
            );
          }
          await expectNoHorizontalScroll(page);
        }
      });
    }

    test("a dialog picker with the software keyboard open stays put", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 360, height: 640 });
      await openLab(page);
      await page.getByRole("button", { name: "Open 500-option dialog" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const input = dialog.getByRole("combobox", {
        name: "Vehicle",
        exact: true,
      });

      const beforeKeyboard = await measureBefore(input);
      await emulateSoftwareKeyboard(page, KEYBOARD);
      const afterKeyboard = await measureBefore(input);
      if (beforeKeyboard.dialog) {
        expectStable(beforeKeyboard.dialog, afterKeyboard.dialog ?? beforeKeyboard.dialog, "the dialog");
      }
      expectStable(beforeKeyboard.input, afterKeyboard.input, "the input");

      const { measured, after } = await expectOverlayFits(page, input);
      expect(measured.list.side, "the list flips above short space").toBe(
        "above",
      );
      expect(measured.hits.map((hit) => hit.label).sort()).toEqual([
        "Cancel",
        "Close dialog",
      ]);
      for (const hit of measured.hits) {
        expect(hit.inside, `${hit.label} stays clickable`).toBe(true);
        expect(hit.overlap, `${hit.label} is not covered`).toBe(0);
      }
      const visibleBottom =
        measured.visualViewport.offsetTop + measured.visualViewport.height;
      expect(after.y + after.height).toBeLessThan(
        visibleBottom,
      );
      await captureForReview(page, "combobox-dialog-keyboard-360");
    });
  },
);

test.describe("picker keyboard contract", () => {
  test("arrow keys, Home, End and Enter move the active option and keep focus", async ({
    page,
  }) => {
    await openLab(page);
    const input = page.getByRole("combobox", {
      name: "Vehicle (500 options)",
    });
    await input.click();
    const list = page.locator("[data-combobox-list]");
    await expect(list).toBeVisible();
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await expect(input).toHaveAttribute("aria-haspopup", "listbox");

    const active = async (): Promise<string | null> =>
      input.getAttribute("aria-activedescendant");
    const first = await active();
    expect(first).toContain("vehicle-001");

    await page.keyboard.press("ArrowDown");
    expect(await active()).toContain("vehicle-002");
    await page.keyboard.press("End");
    expect(await active()).toContain("vehicle-500");
    expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(
      0,
    );
    await page.keyboard.press("Home");
    expect(await active()).toContain("vehicle-001");
    expect(await list.evaluate((element) => element.scrollTop)).toBe(0);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(list).toBeHidden();
    await expect(input).toHaveValue("LSD-002-AA");
    await expect(input).toBeFocused();
  });
});

test.describe("shared search anatomy", () => {
  test("the plate search and every picker use the same control", async ({
    page,
  }) => {
    await openLab(page);
    const anatomy = await page.evaluate(() => {
      const round = (value: number) => Math.round(value * 100) / 100;
      const describe = (input: HTMLInputElement) => {
        const control = input.parentElement;
        const icon = control?.querySelector("svg") ?? null;
        const inputRect = input.getBoundingClientRect();
        const iconRect = icon?.getBoundingClientRect() ?? null;
        const style = window.getComputedStyle(input);
        return {
          height: round(inputRect.height),
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
          fontSize: style.fontSize,
          placeholder: window.getComputedStyle(input, "::placeholder").color,
          icon: iconRect
            ? {
                width: round(iconRect.width),
                height: round(iconRect.height),
                left: round(iconRect.left - inputRect.left),
                centre: round(
                  iconRect.top +
                    iconRect.height / 2 -
                    (inputRect.top + inputRect.height / 2),
                ),
              }
            : null,
        };
      };
      const search = document.querySelector<HTMLInputElement>(
        '[data-testid="lab-search"] input',
      );
      const picker = document.querySelector<HTMLInputElement>(
        '[data-combobox-count="3"] input',
      );
      return {
        search: search ? describe(search) : null,
        picker: picker ? describe(picker) : null,
      };
    });
    expect(anatomy.search).not.toBeNull();
    expect(anatomy.picker).not.toBeNull();
    expect(anatomy.picker).toEqual(anatomy.search);
    expect(anatomy.search?.icon?.width).toBe(16);
    expect(anatomy.search?.icon?.height).toBe(16);
    expect(anatomy.search?.icon?.centre).toBe(0);
  });

  test("both controls take the same focus ring", async ({ page }) => {
    await openLab(page);
    const rings = await page.evaluate(() => {
      const search = document.querySelector<HTMLInputElement>(
        '[data-testid="lab-search"] input',
      );
      const picker = document.querySelector<HTMLInputElement>(
        '[data-combobox-count="3"] input',
      );
      const ring = (input: HTMLInputElement | null) => {
        input?.focus();
        if (!input) return null;
        const style = window.getComputedStyle(input);
        return {
          boxShadow: style.boxShadow,
          borderColor: style.borderColor,
          outline: style.outlineStyle,
        };
      };
      return { search: ring(search), picker: ring(picker) };
    });
    expect(rings.search).not.toBeNull();
    expect(rings.picker).toEqual(rings.search);
  });
});

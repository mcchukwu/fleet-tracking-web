import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  emulateSoftwareKeyboard,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  openPicker,
  setStoredTheme,
} from "./helpers";

/**
 * The picker across every supported viewport, both themes and 3, 25 and 500
 * options. Wide fine-pointer viewports get an anchored popover with 44px rows
 * capped at 360px; narrow or coarse ones get a 56px-row modal sheet capped at
 * 85% of the visual viewport. The dev combobox page makes the option count
 * deterministic.
 */

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 412, height: 915 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
] as const;
const COUNTS = [3, 4, 25, 500] as const;
const KEYBOARD = 260;
const TOLERANCE = 1;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  bottom: number;
}

async function openLab(page: Page): Promise<void> {
  await page.goto("/dev/combobox");
  await expect(page.getByRole("heading", { name: "Combobox lab" })).toBeVisible(
    { timeout: 30_000 },
  );
}

async function box(locator: Locator): Promise<Box> {
  const measured = await locator.boundingBox();
  expect(measured, "the element has no box").not.toBeNull();
  if (!measured) throw new Error("missing box");
  return { ...measured, bottom: measured.y + measured.height };
}

async function rowHeights(scope: Locator): Promise<number[]> {
  return scope
    .getByRole("option")
    .evaluateAll((options) =>
      options.map((option) => option.getBoundingClientRect().height),
    );
}

async function visibleRowCount(scope: Locator): Promise<number> {
  return scope.evaluate((element) => {
    const list = element.querySelector<HTMLElement>('[role="listbox"]');
    if (!list) return 0;
    const listBox = list.getBoundingClientRect();
    return [...list.querySelectorAll('[role="option"]')].filter((option) => {
      const rect = option.getBoundingClientRect();
      return rect.top >= listBox.top - 1 && rect.bottom <= listBox.bottom + 1;
    }).length;
  });
}

async function scrollTop(scope: Locator): Promise<number> {
  return scope.locator('[role="listbox"]').evaluate((list) => list.scrollTop);
}

async function touchSwipeUp(page: Page, target: Locator): Promise<void> {
  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error("the picker list has no box");
  const client = await page.context().newCDPSession(page);
  const x = Math.round(targetBox.x + targetBox.width / 2);
  const startY = Math.round(targetBox.y + targetBox.height - 24);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: startY }],
  });
  for (const offset of [30, 60, 90, 120]) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: startY - offset }],
    });
    await page.waitForTimeout(16);
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.detach();
}

async function touchTap(page: Page, target: Locator): Promise<void> {
  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error("the target has no box");
  const client = await page.context().newCDPSession(page);
  const x = Math.round(targetBox.x + targetBox.width / 2);
  const y = Math.round(targetBox.y + targetBox.height / 2);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.detach();
}

test.describe(
  "picker overlay across viewports, themes and option counts",
  { tag: "@theme" },
  () => {
    for (const viewport of VIEWPORTS) {
      test(`the picker is correct at ${viewport.width}x${viewport.height}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await openLab(page);
        // The coarse-pointer projects keep the sheet even at a wide viewport.
        const sheetExpected = !(await page.evaluate(
          () =>
            window.matchMedia("(min-width: 768px) and (pointer: fine)").matches,
        ));

        for (const count of COUNTS) {
          const picker = await openPicker(page, `Vehicle (${count} options)`);
          expect(picker.presentation).toBe(sheetExpected ? "sheet" : "popover");

          const heights = await rowHeights(picker.scope);
          expect(heights.length).toBeGreaterThan(0);
          for (const height of heights) {
            expect(
              Math.abs(height - (sheetExpected ? 56 : 44)),
              `row height at ${count} options`,
            ).toBeLessThanOrEqual(TOLERANCE);
          }

          if (count === 500) {
            expect(
              await picker.scope
                .locator("[data-picker-list]")
                .getAttribute("data-virtualized"),
            ).toBe("true");
            expect(heights.length).toBeLessThan(500);
          } else {
            expect(heights.length).toBe(count);
          }

          if (sheetExpected) {
            const sheet = picker.scope;
            const sheetBox = await box(sheet);
            const maxHeight = await sheet.evaluate(
              (element) => Number.parseFloat(element.style.maxHeight) || 0,
            );
            expect(sheetBox.y).toBeGreaterThanOrEqual(0);
            expect(sheetBox.bottom).toBeLessThanOrEqual(
              viewport.height + TOLERANCE,
            );
            expect(maxHeight).toBeLessThanOrEqual(viewport.height * 0.85 + 1);
            await expect(picker.search).toBeFocused();
            if (count >= 4) {
              expect(await visibleRowCount(sheet)).toBeGreaterThanOrEqual(4);
            }
            const close = sheet.getByRole("button", { name: "Close picker" });
            await expect(close).toBeVisible();
            const closeBox = await box(close);
            expect(closeBox.width).toBeGreaterThanOrEqual(44 - TOLERANCE);
            expect(closeBox.height).toBeGreaterThanOrEqual(44 - TOLERANCE);
          } else {
            const shell = picker.scope;
            const shellBox = await box(shell);
            const maxHeight = await shell.evaluate((element) =>
              Number.parseFloat(window.getComputedStyle(element).maxHeight),
            );
            expect(maxHeight).toBeLessThanOrEqual(360 + TOLERANCE);
            expect(shellBox.y).toBeGreaterThanOrEqual(0);
            expect(shellBox.bottom).toBeLessThanOrEqual(
              viewport.height + TOLERANCE,
            );
            await expect(picker.trigger).toBeFocused();
          }

          await expect(picker.trigger).toHaveAttribute("aria-expanded", "true");
          await page.keyboard.press("Escape");
          await expect(page.locator("[data-picker-sheet]")).toHaveCount(0);
          await expect(page.locator("[data-combobox-shell]")).toHaveCount(0);
          await expect(picker.trigger).toHaveAttribute(
            "aria-expanded",
            "false",
          );
          await expect(picker.trigger).toBeFocused();
        }

        if (sheetExpected) {
          const stale = await openPicker(page, "Vehicle with a stale list");
          const retry = stale.scope.getByRole("button", { name: "Retry" });
          await expect(retry).toBeVisible();
          const retryBox = await box(retry);
          expect(retryBox.height).toBeGreaterThanOrEqual(44 - TOLERANCE);
          await page.keyboard.press("Escape");
        }

        await expectNoHorizontalScroll(page);
        await captureForReview(
          page,
          `13b-picker-${sheetExpected ? "sheet" : "popover"}-${viewport.width}`,
        );
      });
    }

    test("a coarse pointer at 1024 keeps the 44px sheet controls", async ({
      browser,
    }) => {
      const baseURL = test.info().project.use.baseURL;
      const theme = test.info().project.name.includes("dark")
        ? "dark"
        : "light";
      const context = await browser.newContext({
        viewport: { width: 1024, height: 768 },
        hasTouch: true,
        ...(baseURL ? { baseURL } : {}),
      });
      const page = await context.newPage();
      await setStoredTheme(page, theme);
      try {
        await openLab(page);
        const picker = await openPicker(page, "Vehicle (25 options)");
        expect(picker.presentation).toBe("sheet");
        const close = picker.scope.getByRole("button", {
          name: "Close picker",
        });
        const closeBox = await box(close);
        expect(closeBox.width).toBeGreaterThanOrEqual(44 - TOLERANCE);
        expect(closeBox.height).toBeGreaterThanOrEqual(44 - TOLERANCE);
        await page.keyboard.press("Escape");

        const stale = await openPicker(page, "Vehicle with a stale list");
        const retry = stale.scope.getByRole("button", { name: "Retry" });
        await expect(retry).toBeVisible();
        const retryBox = await box(retry);
        expect(retryBox.height).toBeGreaterThanOrEqual(44 - TOLERANCE);
      } finally {
        await context.close();
      }
    });
  },
);

test.describe("picker interaction", { tag: "@theme" }, () => {
  test("the list scrolls by wheel, touch and keyboard", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLab(page);

    let picker = await openPicker(page, "Vehicle (500 options)");
    let list = picker.scope.locator('[role="listbox"]');
    const listBox = await box(list);
    await page.mouse.move(listBox.x + listBox.width / 2, listBox.y + 40);
    await page.mouse.wheel(0, 500);
    await expect.poll(() => scrollTop(picker.scope)).toBeGreaterThan(0);
    await page.keyboard.press("Escape");

    picker = await openPicker(page, "Vehicle (500 options)");
    list = picker.scope.locator('[role="listbox"]');
    await touchSwipeUp(page, list);
    await expect.poll(() => scrollTop(picker.scope)).toBeGreaterThan(0);
    await page.keyboard.press("Escape");

    picker = await openPicker(page, "Vehicle (500 options)");
    await page.keyboard.press("End");
    await expect.poll(() => scrollTop(picker.scope)).toBeGreaterThan(0);
    await page.keyboard.press("Home");
    await expect.poll(() => scrollTop(picker.scope)).toBe(0);
    await page.keyboard.press("Escape");
  });

  test("selection works by keyboard, mouse and touch and returns focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLab(page);

    let picker = await openPicker(page, "Vehicle (25 options)");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(picker.trigger).toHaveValue("LSD-002-AA");
    await expect(picker.trigger).toBeFocused();

    picker = await openPicker(page, "Vehicle (25 options)");
    await picker.search.fill("LSD-005");
    await picker.scope.getByRole("option", { name: /LSD-005-AA/ }).click();
    await expect(picker.trigger).toHaveValue("LSD-005-AA");
    await expect(picker.trigger).toBeFocused();

    picker = await openPicker(page, "Vehicle (25 options)");
    const option = picker.scope
      .getByRole("option", { name: /LSD-007-AA/ })
      .first();
    await touchTap(page, option);
    await expect(picker.trigger).toHaveValue("LSD-007-AA");
  });

  test("the sheet follows the software keyboard and keeps four rows", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLab(page);
    const picker = await openPicker(page, "Vehicle (25 options)");
    expect(picker.presentation).toBe("sheet");

    await emulateSoftwareKeyboard(page, KEYBOARD);
    const visual = await page.evaluate(() => ({
      height: window.visualViewport?.height ?? window.innerHeight,
      offsetTop: window.visualViewport?.offsetTop ?? 0,
    }));
    const sheetBox = await box(picker.scope);
    expect(sheetBox.y).toBeGreaterThanOrEqual(0);
    expect(sheetBox.bottom).toBeLessThanOrEqual(
      visual.offsetTop + visual.height + TOLERANCE,
    );
    await expect(picker.search).toBeFocused();
    expect(await visibleRowCount(picker.scope)).toBeGreaterThanOrEqual(4);
    const clear = picker.scope.getByRole("button", { name: "Close picker" });
    const clearBox = await box(clear);
    const hit = await page.evaluate(
      ({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return element?.closest('[aria-label="Close picker"]') !== null;
      },
      {
        x: clearBox.x + clearBox.width / 2,
        y: clearBox.y + clearBox.height / 2,
      },
    );
    expect(hit, "the sheet close stays hit-testable").toBe(true);
    await captureForReview(page, "13b-picker-sheet-keyboard-390");
  });

  test("the open and closed picker states are axe clean", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await openLab(page);
    await expectNoAxeViolations(page);
    const picker = await openPicker(page, "Vehicle (25 options)");
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-picker-sheet]")).toHaveCount(0);
    await expectNoAxeViolations(page);
    expect(picker.presentation).toBe("sheet");
  });
});

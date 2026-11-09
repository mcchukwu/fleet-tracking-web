import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview } from "./helpers";

const VEHICLE = "4324a768-9b14-4223-a299-eb8da4d8d309";
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;
const EVENT_COUNTS = [1, 5, 40] as const;

interface Measured {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

async function measure(locator: Locator): Promise<Measured> {
  const box = await locator.boundingBox();
  expect(box, "element has no bounding box").not.toBeNull();
  if (!box) throw new Error("element has no bounding box");
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    right: box.x + box.width,
    bottom: box.y + box.height,
  };
}

async function style(locator: Locator) {
  return locator.evaluate((element) => {
    const value = window.getComputedStyle(element);
    return {
      paddingTop: Number.parseFloat(value.paddingTop),
      paddingRight: Number.parseFloat(value.paddingRight),
      paddingBottom: Number.parseFloat(value.paddingBottom),
      paddingLeft: Number.parseFloat(value.paddingLeft),
      borderRadius: Number.parseFloat(value.borderTopLeftRadius),
      overflowY: value.overflowY,
      fontVariantNumeric: value.fontVariantNumeric,
      minWidth: Number.parseFloat(value.minWidth),
      outlineWidth: Number.parseFloat(value.outlineWidth),
      backgroundColor: value.backgroundColor,
      color: value.color,
    };
  });
}

async function gotoPlayback(page: Page, events: number): Promise<void> {
  await page.goto(`/playback?map=fake&vehicle=${VEHICLE}&events=${events}`);
  await expect(page.getByRole("region", { name: "Playback controls" })).toBeVisible();
  await expect
    .poll(
      () => page.evaluate(() => window.__FLEET_DEBUG__?.playback?.pointCount ?? 0),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
}

function expectAligned(items: Array<{ name: string; box: Measured }>, expectedHeight: number): void {
  const bottom = items[0]?.box.bottom;
  expect(bottom, "no measured controls").toBeDefined();
  for (const { name, box } of items) {
    expect(Math.abs(box.height - expectedHeight), `${name} height`).toBeLessThanOrEqual(0.5);
    expect(Math.abs(box.bottom - (bottom ?? 0)), `${name} bottom`).toBeLessThanOrEqual(0.5);
  }
}

for (const viewport of VIEWPORTS) {
  test.describe(`playback layout ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("keeps one control height, one bottom line and a stable scrubber", async ({ page }) => {
      const mobile = viewport.width < 768;
      const expectedHeight = mobile ? 44 : 32;
      await gotoPlayback(page, 5);

      const transport = page.getByRole("group", { name: "Transport" });
      const transportButtons = transport.getByRole("button");
      await expect(transportButtons).toHaveCount(3);
      const back = transportButtons.nth(0);
      const toggle = transportButtons.nth(1);
      const forward = transportButtons.nth(2);
      const speed = page.getByLabel("Playback speed");
      const events = page.getByRole("button", { name: /^Events \(/ });
      const slider = page.getByRole("slider", { name: "Playback position" });
      const scrubber = slider.locator("xpath=../..");
      const currentTime = page.getByTestId("playback-current-time");

      await expect(speed).toHaveAccessibleName("Playback speed");
      await expect(speed).toHaveValue(/\d+/);
      expect(
        await speed.evaluate(
          (element) => (element as HTMLSelectElement).selectedOptions[0]?.textContent,
        ),
      ).toMatch(/^Speed \d+×$/);
      expect((await style(speed)).paddingLeft).toBeGreaterThan(0);

      const speedWrapper = speed.locator("xpath=../..");
      await expect
        .poll(async () => {
          const wrapper = await measure(speedWrapper);
          const control = await measure(speed);
          return Math.abs(wrapper.height - control.height);
        })
        .toBeLessThanOrEqual(0.5);

      const backBox = await measure(back);
      const toggleBox = await measure(toggle);
      const forwardBox = await measure(forward);
      const speedBox = await measure(speed);
      const eventsBox = await measure(events);
      const scrubberBox = await measure(scrubber);

      expect(toggleBox.x - backBox.right).toBeCloseTo(8, 0);
      expect(forwardBox.x - toggleBox.right).toBeCloseTo(8, 0);
      expect(speedBox.x - forwardBox.right).toBeCloseTo(16, 0);
      expect(eventsBox.x - speedBox.right).toBeCloseTo(16, 0);
      for (const [name, box] of [
        ["back", backBox],
        ["toggle", toggleBox],
        ["forward", forwardBox],
      ] as const) {
        expect(Math.abs(box.width - expectedHeight), `${name} target width`).toBeLessThanOrEqual(0.5);
      }
      const clipped = await Promise.all(
        [speed, events].map((control) =>
          control.evaluate((element) => element.scrollWidth > element.clientWidth + 1),
        ),
      );
      expect(clipped, "speed or events label is clipped").toEqual([false, false]);

      if (mobile) {
        expectAligned(
          [
            { name: "transport back", box: backBox },
            { name: "transport toggle", box: toggleBox },
            { name: "transport forward", box: forwardBox },
            { name: "speed", box: speedBox },
            { name: "events", box: eventsBox },
          ],
          expectedHeight,
        );
        expect(scrubberBox.bottom).toBeLessThanOrEqual(backBox.y);
        expect(Math.abs(scrubberBox.height - expectedHeight)).toBeLessThanOrEqual(0.5);
        const body = await measure(page.getByTestId("playback-controls-body"));
        expect(Math.abs(scrubberBox.x - body.x)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(scrubberBox.width - body.width)).toBeLessThanOrEqual(0.5);
      } else {
        expectAligned(
          [
            { name: "transport back", box: backBox },
            { name: "transport toggle", box: toggleBox },
            { name: "transport forward", box: forwardBox },
            { name: "speed", box: speedBox },
            { name: "events", box: eventsBox },
            { name: "scrubber", box: scrubberBox },
          ],
          expectedHeight,
        );
      }

      const timeStyle = await style(currentTime);
      expect(timeStyle.minWidth).toBeGreaterThan(0);
      expect(timeStyle.fontVariantNumeric).toContain("tabular-nums");

      await slider.focus();
      const start = await measure(slider);
      const middleValue = await slider.evaluate((element) => {
        const input = element as HTMLInputElement;
        return String(Math.round((Number(input.min) + Number(input.max)) / 2));
      });
      await slider.fill(middleValue);
      await expect.poll(async () => (await measure(slider)).x).toBeCloseTo(start.x, 0);
      const middle = await measure(slider);
      await page.keyboard.press("End");
      await expect.poll(async () => (await measure(slider)).x).toBeCloseTo(start.x, 0);
      const end = await measure(slider);

      expect(Math.abs(middle.x - start.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(end.x - start.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(middle.width - start.width)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(end.width - start.width)).toBeLessThanOrEqual(0.5);
      await captureForReview(page, "05-playback-layout-bar");
    });

    test("lays out the events menu without clipping or touching", async ({ page }) => {
      for (const count of EVENT_COUNTS) {
        await gotoPlayback(page, count);
        await page.getByRole("button", { name: /^Events \(/ }).click();
        const menu = page.getByRole("menu");
        await expect(menu).toBeVisible();
        const items = page.getByRole("menuitem");
        await expect(items).toHaveCount(count);

        await captureForReview(page, `05-playback-layout-events-${count}`);
        const menuBox = await measure(menu);
        const menuStyle = await style(menu);
        expect(menuBox.width).toBeGreaterThanOrEqual(320);
        expect(menuBox.height).toBeLessThanOrEqual(viewport.height * 0.6 + 0.5);
        expect(["auto", "scroll"]).toContain(menuStyle.overflowY);
        expect(menuStyle.paddingTop).toBe(4);
        expect(menuStyle.paddingRight).toBe(4);
        expect(menuStyle.paddingBottom).toBe(4);
        expect(menuStyle.paddingLeft).toBe(4);
        if (count === 40) {
          const scrolls = await menu.evaluate(
            (element) => element.scrollHeight > element.clientHeight,
          );
          expect(scrolls, "40-event menu scrolls").toBe(true);
        }

        const first = items.first();
        const firstBox = await measure(first);
        const itemStyle = await style(first);
        expect(firstBox.height).toBeGreaterThanOrEqual(40);
        expect(itemStyle.paddingTop).toBe(8);
        expect(itemStyle.paddingRight).toBe(12);
        expect(itemStyle.paddingBottom).toBe(8);
        expect(itemStyle.paddingLeft).toBe(12);
        expect(itemStyle.borderRadius).toBe(4);
        expect(firstBox.x - menuBox.x).toBeGreaterThanOrEqual(4);
        expect(menuBox.right - firstBox.right).toBeGreaterThanOrEqual(4);

        if (count > 1) {
          const secondBox = await measure(items.nth(1));
          expect(secondBox.y - firstBox.bottom).toBeCloseTo(2, 0);
        }

        const lines = first.locator(":scope > span");
        await expect(lines).toHaveCount(2);
        const labelStyle = await style(lines.nth(0));
        const timeStyle = await style(lines.nth(1));
        expect(timeStyle.color).not.toBe(labelStyle.color);
        expect(timeStyle.fontVariantNumeric).toContain("tabular-nums");

        const badge = first.getByText(/^(Low|Medium|High|Critical)$/);
        await expect(badge).toBeVisible();
        const badgeBox = await measure(badge);
        expect(firstBox.right - badgeBox.right).toBeCloseTo(12, 0);

        if (count > 1) {
          await items.nth(1).hover();
          const hovered = await style(items.nth(1));
          expect(hovered.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
          await page.mouse.move(0, 0);
        }

        await page.keyboard.press("ArrowDown");
        await expect
          .poll(async () => (await style(first)).backgroundColor)
          .not.toBe("rgba(0, 0, 0, 0)");
        const focused = await style(first);
        expect(focused.outlineWidth).toBeGreaterThanOrEqual(2);
        expect(firstBox.x - menuBox.x).toBeGreaterThanOrEqual(focused.outlineWidth);

        await page.keyboard.press("Escape");
        await expect(menu).toBeHidden();
      }
    });
  });
}

import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectTouchTargets,
} from "./helpers";

const VEHICLE = "4324a768-9b14-4223-a299-eb8da4d8d309";
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const EVENT_COUNTS = [0, 5, 40] as const;
const LABELS = ["normal", "long"] as const;

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

async function style(locator: Locator, property: keyof CSSStyleDeclaration) {
  return locator.evaluate(
    (element, name) =>
      (window.getComputedStyle(element) as unknown as Record<string, string>)[name],
    property as string,
  );
}

async function gotoPlayback(
  page: Page,
  events: number,
  labels: (typeof LABELS)[number] = "normal",
): Promise<void> {
  const labelsParam = labels === "long" ? "&labels=long" : "";
  await page.goto(
    `/playback?map=fake&vehicle=${VEHICLE}&events=${events}${labelsParam}`,
  );
  await expect(page.getByRole("region", { name: "Playback controls" })).toBeVisible();
  await expect
    .poll(
      () => page.evaluate(() => window.__FLEET_DEBUG__?.playback?.pointCount ?? 0),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
}

function controls(page: Page): Locator[] {
  return [
    page.getByRole("link", { name: "Back to map" }),
    page.getByRole("button", { name: "Change vehicle" }),
    page.getByLabel("Range"),
    page.getByRole("button", { name: /^Events \(/ }),
    page.getByRole("button", { name: "Fit route" }),
    page.getByLabel("Resolution"),
    page.getByRole("button", { name: "Step back one position" }),
    page.getByRole("button", { name: /^(Play|Pause)$/ }),
    page.getByRole("button", { name: "Step forward one position" }),
    page.getByLabel("Playback speed"),
  ];
}

for (const viewport of VIEWPORTS) {
  test.describe(`playback mobile layout ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    const mobile = viewport.width < 768;

    test("never overflows and keeps every control inside the 12px inset", async ({
      page,
    }) => {
      for (const labels of LABELS) {
        for (const count of EVENT_COUNTS) {
          await gotoPlayback(page, count, labels);
          await expectNoHorizontalScroll(page);
          for (const control of controls(page)) {
            const box = await measure(control);
            expect(
              box.right,
              `control "${await control.getAttribute("aria-label")}" crosses the right inset with events=${count} labels=${labels}`,
            ).toBeLessThanOrEqual(viewport.width - 12 + 0.5);
            expect(box.x).toBeGreaterThanOrEqual(-0.5);
          }
          const options = await measure(page.getByTestId("playback-options"));
          expect(options.right).toBeLessThanOrEqual(viewport.width - 12 + 0.5);
          const scrollWidth = await page.evaluate(
            () => document.documentElement.scrollWidth,
          );
          expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
        }
      }
    });

    test("regroups the top options and keeps the tools at the right edge", async ({
      page,
    }) => {
      await gotoPlayback(page, 5);
      const back = page.getByRole("link", { name: "Back to map" });
      const vehicle = page.getByRole("button", { name: "Change vehicle" });
      const range = page.getByLabel("Range");
      const events = page.getByRole("button", { name: /^Events \(/ });
      const fit = page.getByRole("button", { name: "Fit route" });
      const info = page.getByTestId("playback-options-info");
      const infoText = page.getByTestId("playback-options-info-text");

      expect((await measure(back)).height).toBeGreaterThanOrEqual(mobile ? 44 : 32);
      const vehicleBox = await measure(vehicle);
      const rangeBox = await measure(range);
      const eventsBox = await measure(events);
      const fitBox = await measure(fit);
      const height = mobile ? 44 : 32;

      for (const [name, box] of [
        ["vehicle", vehicleBox],
        ["range", rangeBox],
        ["events", eventsBox],
        ["fit", fitBox],
      ] as const) {
        expect(Math.abs(box.height - height), `${name} height`).toBeLessThanOrEqual(0.5);
        expect(box.right, `${name} right inset`).toBeLessThanOrEqual(
          viewport.width - 12 + 0.5,
        );
      }
      expect(Math.abs(vehicleBox.bottom - rangeBox.bottom)).toBeLessThanOrEqual(0.5);
      expect(rangeBox.x).toBeGreaterThanOrEqual(vehicleBox.right - 0.5);
      expect(rangeBox.right).toBeLessThanOrEqual(eventsBox.x + 0.5);
      expect(Math.abs(fitBox.x - eventsBox.right - 8)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(fitBox.right - (viewport.width - 12))).toBeLessThanOrEqual(0.5);
      expect(Math.abs(eventsBox.y - fitBox.y)).toBeLessThanOrEqual(0.5);

      const eventsLabel = events.getByText(/^Events \(\d+\)$/);
      const fitLabel = fit.getByText("Fit route");
      if (mobile) {
        await expect(eventsLabel).toBeHidden();
        await expect(fitLabel).toBeHidden();
        expect(eventsBox.width).toBeCloseTo(44, 0);
        expect(fitBox.width).toBeCloseTo(44, 0);
      } else {
        await expect(eventsLabel).toBeVisible();
        await expect(fitLabel).toBeVisible();
      }

      await expect(info).toContainText("Resolution:");
      await expect(info).toContainText(" points");
      expect(await style(infoText, "textOverflow")).toBe("ellipsis");
      expect(await style(infoText, "whiteSpace")).toBe("nowrap");
      expect((await measure(infoText)).height).toBeLessThanOrEqual(20);
      await captureForReview(page, "05-playback-mobile-options");
    });

    test("truncates a long plate before the tools move", async ({ page }) => {
      await gotoPlayback(page, 5, "long");
      const vehicle = page.getByRole("button", { name: "Change vehicle" });
      const plate = vehicle.locator("span").first();
      const events = page.getByRole("button", { name: /^Events \(/ });
      const vehicleBox = await measure(vehicle);
      const eventsBox = await measure(events);

      expect(await style(plate, "textOverflow")).toBe("ellipsis");
      expect(vehicleBox.right).toBeLessThanOrEqual(eventsBox.x);
      if (viewport.width <= 412) {
        const truncates = await plate.evaluate(
          (element) => element.scrollWidth > element.clientWidth + 1,
        );
        expect(truncates, "the long plate truncates").toBe(true);
      }
      await expectNoHorizontalScroll(page);
    });

    test("keeps one bar on desktop and two centred rows on mobile", async ({
      page,
    }) => {
      await gotoPlayback(page, 5);
      const transport = page.getByRole("group", { name: "Transport" });
      const transportButtons = transport.getByRole("button");
      const back = transportButtons.nth(0);
      const toggle = transportButtons.nth(1);
      const forward = transportButtons.nth(2);
      const speed = page.getByLabel("Playback speed");
      const slider = page.getByRole("slider", { name: "Playback position" });
      const scrubber = page.getByTestId("playback-scrubber");
      const current = page.getByTestId("playback-current-time");
      const lane = page.getByTestId("playback-event-band");
      const readout = page.getByTestId("playback-readout");

      const backBox = await measure(back);
      const toggleBox = await measure(toggle);
      const forwardBox = await measure(forward);
      const speedBox = await measure(speed);
      const scrubberBox = await measure(scrubber);
      const laneBox = await measure(lane);
      const currentBox = await measure(current);
      const height = mobile ? 44 : 32;

      expect(Math.abs(toggleBox.x - backBox.right - 8), "back to toggle").toBeLessThanOrEqual(0.5);
      expect(Math.abs(forwardBox.x - toggleBox.right - 8), "toggle to forward").toBeLessThanOrEqual(0.5);
      expect(laneBox.height).toBeGreaterThanOrEqual(mobile ? 44 : 28);
      expect(await style(current, "minWidth")).not.toBe("0px");
      expect(await style(current, "fontVariantNumeric")).toContain("tabular-nums");

      if (mobile) {
        expect(Math.abs(scrubberBox.x - 12)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(scrubberBox.right - (viewport.width - 12))).toBeLessThanOrEqual(0.5);
        expect(Math.abs(scrubberBox.height - (height + laneBox.height))).toBeLessThanOrEqual(0.5);
        expect(Math.abs(toggleBox.height - height)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(speedBox.height - height)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(speedBox.bottom - toggleBox.bottom)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(speedBox.x - forwardBox.right - 16)).toBeLessThanOrEqual(0.5);
        expect(toggleBox.y).toBeGreaterThanOrEqual(scrubberBox.bottom - 0.5);
        const centre = (backBox.x + speedBox.right) / 2;
        expect(Math.abs(centre - viewport.width / 2)).toBeLessThanOrEqual(1);
        expect(await style(page.getByTestId("playback-controls-body"), "flexWrap")).toBe("nowrap");
        await expectTouchTargets(page, 44);
      } else {
        const readoutBox = await measure(readout);
        const items = [backBox, readoutBox, scrubberBox, speedBox];
        const bottom = items[0]?.bottom ?? 0;
        for (const item of items) {
          expect(Math.abs(item.bottom - bottom), "one bottom line").toBeLessThanOrEqual(0.5);
        }
        expect(backBox.right).toBeLessThanOrEqual(readoutBox.x + 0.5);
        expect(readoutBox.right).toBeLessThanOrEqual(scrubberBox.x + 0.5);
        expect(scrubberBox.right).toBeLessThanOrEqual(speedBox.x + 0.5);
        expect(Math.abs(scrubberBox.height - (height + laneBox.height))).toBeLessThanOrEqual(0.5);
        expect(await style(readout, "display")).toBe("flex");
      }

      await slider.focus();
      const start = await measure(slider);
      const middleValue = await slider.evaluate((element) => {
        const input = element as HTMLInputElement;
        return String(Math.round((Number(input.min) + Number(input.max)) / 2));
      });
      await slider.fill(middleValue);
      const middle = await measure(slider);
      await page.keyboard.press("End");
      const end = await measure(slider);
      expect(Math.abs(middle.x - start.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(end.x - start.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(middle.width - start.width)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(end.width - start.width)).toBeLessThanOrEqual(0.5);
      expect(currentBox.width).toBeGreaterThan(0);
      await captureForReview(page, "05-playback-mobile-bar");
    });

    test("opens the events menu anchored inside the viewport", async ({ page }) => {
      for (const count of EVENT_COUNTS) {
        await gotoPlayback(page, count);
        const trigger = page.getByRole("button", { name: /^Events \(/ });
        if (count === 0) {
          await expect(trigger).toBeDisabled();
          await expect(page.getByRole("menu")).toHaveCount(0);
          continue;
        }
        const triggerBox = await measure(trigger);
        await trigger.click();
        const menu = page.getByRole("menu");
        await expect(menu).toBeVisible();
        const items = page.getByRole("menuitem");
        await expect(items).toHaveCount(count);
        const menuBox = await measure(menu);
        const expectedWidth = Math.min(320, viewport.width - 24);
        expect(Math.abs(menuBox.width - expectedWidth)).toBeLessThanOrEqual(1);
        expect(menuBox.x).toBeGreaterThanOrEqual(12 - 0.5);
        expect(menuBox.right).toBeLessThanOrEqual(viewport.width - 12 + 0.5);
        expect(menuBox.y).toBeGreaterThanOrEqual(12 - 0.5);
        expect(menuBox.x).toBeLessThanOrEqual(triggerBox.right);
        expect(menuBox.right).toBeGreaterThanOrEqual(triggerBox.x);
        expect(menuBox.height).toBeLessThanOrEqual(viewport.height * 0.6 + 0.5);
        expect(await style(menu, "overflowY")).toMatch(/auto|scroll/);
        if (count === 40) {
          expect(
            await menu.evaluate((element) => element.scrollHeight > element.clientHeight),
          ).toBe(true);
        }

        const first = items.first();
        const firstBox = await measure(first);
        expect(firstBox.height).toBeGreaterThanOrEqual(40);
        expect(await style(first, "paddingTop")).toBe("8px");
        expect(await style(first, "paddingLeft")).toBe("12px");
        expect(await style(first, "borderRadius")).toBe("4px");
        expect(firstBox.x - menuBox.x).toBeGreaterThanOrEqual(4);
        expect(menuBox.right - firstBox.right).toBeGreaterThanOrEqual(4);
        const lines = first.locator(":scope > span");
        await expect(lines).toHaveCount(2);
        expect(await style(lines.nth(1), "fontVariantNumeric")).toContain("tabular-nums");
        const badge = first.getByText(/^(Low|Medium|High|Critical)$/);
        await expect(badge).toBeVisible();
        const badgeBox = await measure(badge);
        expect(firstBox.right - badgeBox.right).toBeCloseTo(12, 0);
        if (count > 1) {
          const secondBox = await measure(items.nth(1));
          expect(secondBox.y - firstBox.bottom).toBeCloseTo(2, 0);
          await items.nth(1).hover();
          expect(await style(items.nth(1), "backgroundColor")).not.toBe("rgba(0, 0, 0, 0)");
          await page.mouse.move(0, 0);
        }
        await page.keyboard.press("ArrowDown");
        await expect
          .poll(async () => style(first, "backgroundColor"))
          .not.toBe("rgba(0, 0, 0, 0)");
        expect(Number.parseFloat(await style(first, "outlineWidth"))).toBeGreaterThanOrEqual(2);
        await expectNoHorizontalScroll(page);
        await page.keyboard.press("Escape");
        await expect(menu).toBeHidden();
      }
    });

    if (mobile) {
      test("seeks by pointer and picks the nearest event on the lane", async ({ page }) => {
        await gotoPlayback(page, 40);
        const slider = page.getByRole("slider", { name: "Playback position" });
        const sliderBox = await measure(slider);
        const lane = page.getByTestId("playback-event-band");
        const laneBox = await measure(lane);
        expect(laneBox.bottom).toBeLessThanOrEqual(sliderBox.y + 0.5);
        expect(laneBox.height).toBeGreaterThanOrEqual(44);

        const markers = page.getByTestId("playback-event-marker");
        await expect(markers).toHaveCount(40);
        for (const marker of await markers.all()) {
          const box = await measure(marker);
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }

        const before = await measure(markers.nth(20));
        const after = await measure(markers.nth(21));
        const clickX = (before.x + before.width / 2 + after.x + after.width / 2) / 2;
        const clickY = sliderBox.y + sliderBox.height / 2;
        await page.mouse.click(clickX, clickY);
        const state = await slider.evaluate((element) => {
          const input = element as HTMLInputElement;
          return {
            min: Number(input.min),
            max: Number(input.max),
            step: Number(input.step),
            value: Number(input.value),
          };
        });
        const raw =
          state.min +
          ((clickX - sliderBox.x) / sliderBox.width) * (state.max - state.min);
        const expected = Math.min(
          state.max,
          Math.max(
            state.min,
            state.min + Math.round((raw - state.min) / state.step) * state.step,
          ),
        );
        expect(Math.abs(state.value - expected)).toBeLessThanOrEqual(state.step);

        const laneClickY = laneBox.y + laneBox.height / 2;
        const laneClickX = (before.x + before.width / 2 + after.x + after.width / 2) / 2;
        await page.mouse.move(laneClickX, laneClickY);
        const earlierLabel = (await markers.nth(20).getAttribute("aria-label")) ?? "";
        const preview = earlierLabel
          .slice(0, earlierLabel.lastIndexOf(" at "))
          .replace(/\s*\((?:low|medium|high|critical)\)$/, "");
        await expect(page.getByTestId("playback-current-time")).toContainText(preview);
        await page.mouse.click(laneClickX, laneClickY);
        const valueText =
          (await slider.getAttribute("aria-valuetext")) ?? "";
        const expectedTime = earlierLabel.slice(earlierLabel.lastIndexOf(" at ") + 4);
        expect(valueText).toContain(expectedTime);
        await captureForReview(page, "05-playback-mobile-pointer");
      });
    }
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
] as const) {
  test.describe(`playback states ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("keeps state actions clear of the control bar and always shows attribution", async ({
      page,
    }) => {
      await page.goto(
        `/playback?map=fake&vehicle=${VEHICLE}&fault=vehicle-history:server`,
      );
      await expect(
        page.getByText("Something went wrong on our side"),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("map-attribution")).toBeVisible();
      const retry = page.getByRole("button", { name: "Retry" }).first();
      await expect(retry).toBeVisible();
      await expectNoOverlap(
        retry,
        page.getByRole("region", { name: "Playback controls" }),
      );
      await retry.click();
      await captureForReview(page, "05-playback-state-clear");
    });

    test("shows attribution with the picker and an invalid range", async ({
      page,
    }) => {
      await page.goto("/playback?map=fake");
      await expect(page.getByTestId("map-attribution")).toBeVisible();

      await page.goto(
        `/playback?map=fake&vehicle=${VEHICLE}&from=2026-11-08T16:00:00Z&to=2026-11-08T14:00:00Z`,
      );
      await expect(page.getByText("Choose a valid range")).toBeVisible();
      await expect(page.getByTestId("map-attribution")).toBeVisible();
    });
  });
}

test.describe("playback map area 360x640", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("keeps at least 40% of the viewport visible between the bars", async ({
    page,
  }) => {
    await gotoPlayback(page, 40, "long");
    const options = await measure(page.getByTestId("playback-options"));
    const bar = await measure(page.getByRole("region", { name: "Playback controls" }));
    const visible = bar.y - options.bottom;
    expect(visible).toBeGreaterThanOrEqual(640 * 0.4);
  });
});

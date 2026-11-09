import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectTouchTargets,
} from "./helpers";

const VEHICLE = "4324a768-9b14-4223-a299-eb8da4d8d309";
const GAP_VEHICLE = "795b5251-1a04-475a-8df1-9aa1f9281bfc";

async function gotoPlayback(page: Page, search = ""): Promise<void> {
  await page.goto(`/playback?map=fake${search ? `&${search}` : ""}`);
  await expect(page.getByRole("region", { name: "Playback map" })).toBeVisible();
}

async function playback(page: Page) {
  return page.evaluate(() => window.__FLEET_DEBUG__?.playback ?? null);
}

async function waitForPoints(page: Page, minimum = 1): Promise<void> {
  await expect
    .poll(async () => (await playback(page))?.pointCount ?? 0, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(minimum);
}

async function openVehicle(page: Page, plate: string): Promise<void> {
  const combo = page.getByRole("combobox", { name: "Vehicle" });
  await combo.click();
  await combo.fill(plate);
  await page.getByRole("option").filter({ hasText: plate }).first().click();
}

test.describe("playback", () => {
  test("picks a vehicle, writes the default range and draws the route", async ({ page }) => {
    await gotoPlayback(page);
    await expect(page.getByRole("heading", { name: "Choose a vehicle" })).toBeVisible();
    await expect(page).toHaveURL(/resolution=30s/);
    await expect(page).toHaveURL(/from=/);

    await openVehicle(page, "LSD-100-AA");
    await expect(page).toHaveURL(new RegExp(`vehicle=${VEHICLE}`));
    await waitForPoints(page);
    await expect(page.getByRole("heading", { name: "Playback" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Playback controls" })).toBeVisible();
    await expect.poll(() => page.title()).toBe("Playback · Fleet Console");

    await captureForReview(page, "05-playback-ready");
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test("round-trips the range and resolution through the URL", async ({ page }) => {
    const to = new Date();
    const from = new Date(to.getTime() - 2 * 60 * 60_000);
    const search = `vehicle=${VEHICLE}&from=${encodeURIComponent(
      from.toISOString(),
    )}&to=${encodeURIComponent(to.toISOString())}&resolution=30s`;
    await gotoPlayback(page, search);
    await waitForPoints(page);

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`vehicle=${VEHICLE}`));
    await waitForPoints(page);

    await page.getByLabel("Range").selectOption("30m");
    await expect(page).toHaveURL(/resolution=30s/);
    const times = await page.evaluate(() => {
      const params = new URLSearchParams(window.location.search);
      return {
        from: Date.parse(params.get("from") ?? ""),
        to: Date.parse(params.get("to") ?? ""),
      };
    });
    expect(Math.round((times.to - times.from) / 60_000)).toBe(30);

    await page.getByLabel("Resolution").selectOption("auto");
    await expect(page).toHaveURL(/resolution=auto/);
    await expect(page.getByText(/^Resolution: /)).toBeVisible();
    await waitForPoints(page);
  });

  test("plays, pauses and steps through points", async ({ page }) => {
    await gotoPlayback(page, `vehicle=${VEHICLE}`);
    await waitForPoints(page, 10);
    const initial = (await playback(page))?.playheadMs ?? 0;

    await page.getByRole("button", { name: "Play" }).click();
    await expect
      .poll(async () => (await playback(page))?.playheadMs ?? 0, { timeout: 10_000 })
      .toBeGreaterThan(initial + 500);

    await page.getByRole("button", { name: "Pause" }).click();
    const paused = (await playback(page))?.playheadMs ?? 0;
    await page.waitForTimeout(300);
    expect((await playback(page))?.playheadMs).toBe(paused);

    await page.getByRole("button", { name: "Step forward one position" }).click();
    expect((await playback(page))?.playheadMs ?? 0).toBeGreaterThan(paused);
  });

  test("seeks with the scrubber keyboard", async ({ page }) => {
    await gotoPlayback(page, `vehicle=${VEHICLE}`);
    await waitForPoints(page, 10);
    const slider = page.getByRole("slider", { name: "Playback position" });
    await expect(slider).toHaveAttribute("aria-valuetext", /\d{2}:\d{2}:\d{2}/);

    await slider.focus();
    await page.keyboard.press("End");
    await expect
      .poll(async () => (await playback(page))?.playheadMs ?? 0)
      .toBeGreaterThan(Date.now() - 24 * 60 * 60_000);
    await page.keyboard.press("Home");
    await expect
      .poll(async () => (await playback(page))?.playheadMs ?? 0)
      .toBeLessThan(Date.now() - 60 * 60_000);
  });

  test("draws gaps honestly for the gap fixture", async ({ page }) => {
    await gotoPlayback(page, `vehicle=${GAP_VEHICLE}`);
    await expect
      .poll(async () => (await playback(page))?.gapCount ?? 0, { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect(page.getByText(/No data .* to .*/).first()).toBeVisible();
    await captureForReview(page, "05-playback-gap");
    await expectNoAxeViolations(page);
  });

  test("lists events and jumps to one", async ({ page }) => {
    await gotoPlayback(page, `vehicle=${VEHICLE}`);
    await waitForPoints(page, 10);
    await expect
      .poll(async () => (await playback(page))?.eventCount ?? 0, { timeout: 15_000 })
      .toBeGreaterThan(1);

    await page.getByRole("button", { name: /^Events \(/ }).click();
    const row = page.getByRole("menuitem").filter({ hasText: "Speeding" }).first();
    await expect(row).toBeVisible();
    await row.click();
    await expect.poll(async () => (await playback(page))?.playing).toBe(false);
  });

  test("keeps a cached route offline and shows the saved-data badge", async ({ page, context }) => {
    await gotoPlayback(page, `vehicle=${VEHICLE}`);
    await waitForPoints(page, 10);
    const points = (await playback(page))?.pointCount ?? 0;

    await context.setOffline(true);
    await expect(page.getByText("Offline · showing saved data")).toBeVisible({ timeout: 10_000 });
    expect((await playback(page))?.pointCount ?? 0).toBe(points);
    await context.setOffline(false);
  });

  test("keeps the header and controls apart on both viewports", async ({ page }) => {
    await gotoPlayback(page, `vehicle=${VEHICLE}`);
    await waitForPoints(page, 10);

    await expectNoHorizontalScroll(page);
    await expectNoOverlap(
      page.getByRole("banner"),
      page.getByRole("region", { name: "Playback controls" }),
    );
    const viewport = page.viewportSize();
    if ((viewport?.width ?? 1440) < 1024) {
      await expectTouchTargets(page, 44);
    }
    await captureForReview(page, "05-playback-controls");
  });
});

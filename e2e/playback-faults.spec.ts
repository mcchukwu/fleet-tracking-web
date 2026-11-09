import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations, expectNoHorizontalScroll } from "./helpers";

const VEHICLE = "4324a768-9b14-4223-a299-eb8da4d8d309";

async function gotoFault(page: Page, fault: string): Promise<void> {
  await page.goto(`/playback?map=fake&vehicle=${VEHICLE}&fault=${fault}`);
  await expect(page.getByRole("region", { name: "Playback map" })).toBeVisible();
}

test.describe("playback faults", () => {
  test("shows a retryable server error with nothing cached", async ({ page }) => {
    await gotoFault(page, "vehicle-history:server");
    await expect(page.getByText("Something went wrong on our side")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("shows the contract error with diagnostics", async ({ page }) => {
    await gotoFault(page, "vehicle-history:contract");
    await expect(page.getByText("Unexpected response from the server")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Copy diagnostics" })).toBeVisible();
  });

  test("shows the forbidden state", async ({ page }) => {
    await gotoFault(page, "vehicle-history:forbidden");
    await expect(page.getByText("You don't have access to this.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Back to map" })).toBeVisible();
  });

  test("shows the slow state and keeps Cancel available", async ({ page }) => {
    await gotoFault(page, "vehicle-history:slow");
    await expect(page.getByText("Still working…")).toBeVisible({ timeout: 8_000 });
    await captureForReview(page, "05-playback-slow");
  });

  test("keeps the route usable when events fail and names unknown events", async ({ page }) => {
    await gotoFault(page, "vehicle-events:server");
    await expect(page.getByRole("region", { name: "Playback controls" })).toBeVisible();

    await page.goto(`/playback?map=fake&vehicle=${VEHICLE}&fault=vehicle-events:unknown_enum`);
    await expect
      .poll(
        () => page.evaluate(() => window.__FLEET_DEBUG__?.playback?.eventCount ?? 0),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: /^Events \(/ }).click();
    await expect(page.getByText("Unknown event: solar_flare")).toBeVisible();
  });

  test("keeps the controls when the map adapter fails", async ({ page }) => {
    await page.goto(`/playback?map=fake&vehicle=${VEHICLE}&adapter=error`);
    await expect(page.getByText("The map couldn't load")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("region", { name: "Playback controls" })).toBeVisible();
  });

  test("contains an injected render crash in the panel boundary", async ({ page }) => {
    await page.goto(`/playback?map=fake&vehicle=${VEHICLE}&crash=playback`);
    await expect(page.getByText("This part of the page stopped working")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
  });

  test("shows an unknown vehicle as empty, not an error", async ({ page }) => {
    await page.goto(
      "/playback?map=fake&vehicle=00000000-0000-0000-0000-000000000000&resolution=5m",
    );
    await expect(page.getByText("No positions in this range")).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalScroll(page);
  });
});

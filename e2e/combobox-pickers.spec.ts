import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoHorizontalScroll,
  openPicker,
  type PickerHandle,
} from "./helpers";

/**
 * Every real picker in every dialog, in both presentations. Opening a picker
 * never moves the trigger or the dialog. The popover leaves Cancel and the
 * dialog close reachable; the modal sheet covers them and provides its own
 * 44px close, backdrop and Escape path.
 */

const PLAYBACK_VEHICLE = "4324a768-9b14-4223-a299-eb8da4d8d309";
const TOLERANCE = 0.5;

async function isHitTestable(page: Page, locator: Locator): Promise<boolean> {
  const box = await locator.boundingBox();
  if (!box) return false;
  return page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return (
        element !== null &&
        element.closest('[aria-label="Close picker"]') !== null
      );
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
}

async function expectPicker(
  page: Page,
  dialog: Locator,
  label: string,
): Promise<PickerHandle> {
  const named = dialog
    .getByRole("combobox", { name: label, exact: true })
    .first();
  // Once the modal sheet is open Radix hides the parent dialog from the
  // accessibility tree, so keep a selector that still measures the trigger.
  const id = await named.getAttribute("id");
  const trigger = id ? page.locator(`input[id="${id}"]`) : named;
  const parent = page
    .locator('[role="dialog"]:not([data-picker-sheet])')
    .first();
  const triggerBefore = await trigger.boundingBox();
  const dialogBefore = await parent.boundingBox();

  const picker = await openPicker(page, label, dialog);
  const triggerAfter = await trigger.boundingBox();
  const dialogAfter = await parent.boundingBox();

  for (const key of ["x", "y", "width", "height"] as const) {
    expect(
      Math.abs((triggerAfter?.[key] ?? 0) - (triggerBefore?.[key] ?? 0)),
      `the trigger ${key} moved when the picker opened`,
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(
      Math.abs((dialogAfter?.[key] ?? 0) - (dialogBefore?.[key] ?? 0)),
      `the dialog ${key} moved when the picker opened`,
    ).toBeLessThanOrEqual(TOLERANCE);
  }

  if (picker.presentation === "popover") {
    await expect(picker.scope).toHaveCSS("position", "fixed");
    for (const name of ["Cancel", "Close dialog"]) {
      const control = dialog.getByRole("button", { name, exact: true });
      if ((await control.count()) === 0) continue;
      const box = await control.boundingBox();
      if (!box) continue;
      const hit = await page.evaluate(
        ({ x, y }) => {
          const element = document.elementFromPoint(x, y);
          return element !== null && element.closest("button") !== null;
        },
        { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      );
      expect(hit, `${name} stays hit-testable under the popover`).toBe(true);
    }
  } else {
    const sheet = picker.scope;
    const sheetBox = await sheet.boundingBox();
    expect(sheetBox, "the sheet has no box").not.toBeNull();
    expect(sheetBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    const close = sheet.getByRole("button", { name: "Close picker" });
    await expect(close).toBeVisible();
    expect(await isHitTestable(page, close)).toBe(true);

    // The sheet is modal: the parent dialog's close is behind the backdrop.
    const parentClose = parent.getByRole("button", { name: "Close dialog" });
    if ((await parentClose.count()) > 0) {
      const box = await parentClose.boundingBox();
      if (box) {
        const parentHit = await page.evaluate(
          ({ x, y }) => {
            const element = document.elementFromPoint(x, y);
            return (
              element !== null &&
              element.closest('[aria-label="Close dialog"]') !== null
            );
          },
          { x: box.x + box.width / 2, y: box.y + box.height / 2 },
        );
        expect(parentHit, "the sheet supersedes the parent dialog").toBe(false);
      }
    }
  }

  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-picker-sheet]")).toHaveCount(0);
  await expect(page.locator("[data-combobox-shell]")).toHaveCount(0);
  await expect(parent).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
  return picker;
}

async function openDrawer(page: Page): Promise<void> {
  const desktop = (page.viewportSize()?.width ?? 1440) >= 1024;
  if (!desktop) {
    const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
    await handle.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowUp");
  }
  await page.getByRole("button", { name: "Select LSD-100-AA" }).click();
  await expect(
    page.getByText("Vehicle details", { exact: true }),
  ).toBeVisible();
  if (!desktop) {
    await page.keyboard.press("End");
    await page.waitForTimeout(250);
  }
}

async function gotoMap(page: Page): Promise<void> {
  await page.goto("/map?map=fake");
  await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
}

test.describe("picker overlay in every dialog", () => {
  test("the Playback change-vehicle picker respects the dialog", async ({
    page,
  }) => {
    await page.goto(`/playback?map=fake&vehicle=${PLAYBACK_VEHICLE}`);
    await expect(
      page.getByRole("region", { name: "Playback controls" }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Change vehicle" }).click();
    const dialog = page.getByRole("dialog", { name: "Change vehicle" });
    await expect(dialog).toBeVisible();

    const picker = await expectPicker(page, dialog, "Vehicle");
    await captureForReview(page, `13b-picker-playback-${picker.presentation}`);
    await expectNoHorizontalScroll(page);
  });

  test("the assign-driver picker respects the dialog", async ({ page }) => {
    await gotoMap(page);
    await openDrawer(page);
    await page.getByRole("button", { name: "Assign driver" }).first().click();
    const dialog = page.getByRole("dialog", { name: /^Assign a driver to/ });
    await expect(dialog).toBeVisible();

    const picker = await expectPicker(page, dialog, "Driver");
    await captureForReview(
      page,
      `13b-picker-assign-driver-${picker.presentation}`,
    );
  });

  test("the edit-vehicle picker respects the dialog", async ({ page }) => {
    await gotoMap(page);
    await openDrawer(page);
    await page
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: /^Edit / });
    await expect(dialog).toBeVisible();

    const picker = await expectPicker(page, dialog, "Driver");
    await captureForReview(
      page,
      `13b-picker-edit-vehicle-${picker.presentation}`,
    );
  });

  test("the trip-create vehicle picker respects the dialog", async ({
    page,
  }) => {
    await page.goto("/trips");
    await expect(
      page.getByRole("heading", { name: "Trips", level: 1 }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Create trip" }).click();
    const dialog = page.getByRole("dialog", { name: "Create trip" });
    await expect(dialog).toBeVisible();

    const picker = await expectPicker(page, dialog, "Vehicle");
    await captureForReview(
      page,
      `13b-picker-trip-create-${picker.presentation}`,
    );
    await expectNoHorizontalScroll(page);
  });
});

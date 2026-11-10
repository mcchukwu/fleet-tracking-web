import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoHorizontalScroll } from "./helpers";

/**
 * Every picker, in every dialog: opening the list is an overlay. It never
 * moves the input or the dialog, and it never covers Cancel or the close
 * button. Measurements, not impressions.
 */

const PLAYBACK_VEHICLE = "4324a768-9b14-4223-a299-eb8da4d8d309";
const TOLERANCE = 0.5;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

interface PickerMeasurement {
  input: Box | null;
  dialog: Box | null;
  list: (Box & {
    position: string;
    overflowY: string;
    maxHeight: number;
    clientHeight: number;
    scrollHeight: number;
    portalled: boolean;
    side: "below" | "above";
    gap: number;
  }) | null;
  hits: Array<{ label: string; hit: string; inside: boolean; overlap: number }>;
  scrollY: number;
  viewport: { width: number; height: number };
  visualViewport: { width: number; height: number; offsetTop: number };
  listZ: number;
  dialogZ: number;
}

async function measurePicker(page: Page): Promise<PickerMeasurement> {
  return page.evaluate(() => {
    const round = (value: number) => Math.round(value * 100) / 100;
    const toBox = (value: DOMRect) => ({
      x: round(value.x),
      y: round(value.y),
      width: round(value.width),
      height: round(value.height),
      bottom: round(value.bottom),
      right: round(value.right),
    });
    const input = document.querySelector<HTMLInputElement>(
      '[role="dialog"] [role="combobox"]',
    );
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const list = document.querySelector<HTMLElement>("[data-combobox-list]");
    const inputRect = input?.getBoundingClientRect() ?? null;
    const listRect = list?.getBoundingClientRect() ?? null;
    const style = list ? window.getComputedStyle(list) : null;

    const hits: Array<{
      label: string;
      hit: string;
      inside: boolean;
      overlap: number;
    }> = [];
    if (dialog && listRect) {
      for (const button of dialog.querySelectorAll<HTMLElement>("button")) {
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
          hit: hit
            ? hit === button || button.contains(hit)
              ? label
              : (hit.getAttribute("aria-label") ??
                hit.textContent?.trim().slice(0, 24) ??
                hit.tagName)
            : "none",
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
      input: inputRect ? toBox(inputRect) : null,
      dialog: dialog ? toBox(dialog.getBoundingClientRect()) : null,
      list:
        listRect && style && inputRect
          ? {
              ...toBox(listRect),
              position: style.position,
              overflowY: style.overflowY,
              maxHeight: Number.parseFloat(style.maxHeight) || 0,
              clientHeight: list?.clientHeight ?? 0,
              scrollHeight: list?.scrollHeight ?? 0,
              portalled:
                list?.closest('[data-layer-portal="popover"]') !== null,
              side:
                listRect.top >= inputRect.bottom
                  ? ("below" as const)
                  : ("above" as const),
              gap:
                listRect.top >= inputRect.bottom
                  ? round(listRect.top - inputRect.bottom)
                  : round(inputRect.top - listRect.bottom),
            }
          : null,
      hits,
      scrollY: window.scrollY,
      listZ: list
        ? Number(
            window.getComputedStyle(
              list.closest<HTMLElement>("[data-layer-portal]") ?? list,
            ).zIndex,
          )
        : 0,
      dialogZ: dialog
        ? Number(
            window.getComputedStyle(
              dialog.closest<HTMLElement>("[data-layer-portal]") ?? dialog,
            ).zIndex,
          )
        : 0,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      visualViewport: {
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
        offsetTop: viewport?.offsetTop ?? 0,
      },
    };
  });
}

async function expectPickerOverlay(page: Page, input: Locator): Promise<void> {
  const before = await measurePicker(page);
  expect(before.input, "the picker input exists").not.toBeNull();
  expect(before.dialog, "the picker is inside a dialog").not.toBeNull();

  await input.click();
  const list = page.locator("[data-combobox-list]");
  await expect(list).toBeVisible();
  const after = await measurePicker(page);

  expect(after.input).not.toBeNull();
  expect(after.dialog).not.toBeNull();
  expect(after.list).not.toBeNull();

  for (const key of ["x", "y", "width", "height"] as const) {
    expect(
      Math.abs((after.input?.[key] ?? 0) - (before.input?.[key] ?? 0)),
      `the input ${key} did not change when the list opened`,
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(
      Math.abs((after.dialog?.[key] ?? 0) - (before.dialog?.[key] ?? 0)),
      `the dialog ${key} did not change when the list opened`,
    ).toBeLessThanOrEqual(TOLERANCE);
  }
  expect(after.scrollY, "opening the list did not scroll the page").toBe(
    before.scrollY,
  );

  const listBox = after.list;
  expect(listBox?.position).toBe("fixed");
  expect(listBox?.portalled, "the list renders in the popover layer").toBe(
    true,
  );
  expect(
    after.listZ,
    "the list is above the dialog layer, never below Cancel or Close",
  ).toBeGreaterThan(after.dialogZ);
  expect(["auto", "scroll"]).toContain(listBox?.overflowY);

  const expectedWidth = Math.max(
    240,
    Math.min(after.input?.width ?? 0, after.viewport.width - 16),
  );
  expect(listBox?.width ?? 0).toBeCloseTo(expectedWidth, 1);

  if (listBox?.side === "below") {
    expect(listBox.gap).toBeCloseTo(4, 1);
  } else {
    expect(listBox?.gap ?? 0).toBeCloseTo(4, 1);
    expect(listBox?.bottom ?? 0).toBeLessThanOrEqual(
      (after.input?.y ?? 0) + TOLERANCE,
    );
  }

  const visibleTop = after.visualViewport.offsetTop;
  const visibleBottom = visibleTop + after.visualViewport.height;
  expect(listBox?.y ?? 0).toBeGreaterThanOrEqual(visibleTop - TOLERANCE);
  expect(listBox?.bottom ?? 0).toBeLessThanOrEqual(
    visibleBottom + TOLERANCE,
  );
  if ((listBox?.scrollHeight ?? 0) > (listBox?.clientHeight ?? 0)) {
    expect(listBox?.maxHeight ?? 0).toBeLessThanOrEqual(
      visibleBottom - visibleTop,
    );
  }

  expect(after.hits.map((hit) => hit.label).sort()).toEqual([
    "Cancel",
    "Close dialog",
  ]);
  for (const hit of after.hits) {
    expect(hit.inside, `${hit.label} is hit-testable: ${hit.hit}`).toBe(true);
    expect(hit.overlap, `${hit.label} is not covered by the list`).toBe(0);
  }

  await expect(input).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
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
  await expect(page.getByText("Vehicle details", { exact: true })).toBeVisible();
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
  test("the Playback change-vehicle picker is an overlay", async ({ page }) => {
    await page.goto(`/playback?map=fake&vehicle=${PLAYBACK_VEHICLE}`);
    await expect(
      page.getByRole("region", { name: "Playback controls" }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Change vehicle" }).click();
    const dialog = page.getByRole("dialog", { name: "Change vehicle" });
    await expect(dialog).toBeVisible();

    await expectPickerOverlay(
      page,
      dialog.getByRole("combobox", { name: "Vehicle", exact: true }),
    );
    await captureForReview(page, "combobox-playback-change");
    await expectNoHorizontalScroll(page);
  });

  test("the assign-driver picker is an overlay", async ({ page }) => {
    await gotoMap(page);
    await openDrawer(page);
    await page.getByRole("button", { name: "Assign driver" }).first().click();
    const dialog = page.getByRole("dialog", {
      name: /^Assign a driver to/,
    });
    await expect(dialog).toBeVisible();

    await expectPickerOverlay(
      page,
      dialog.getByRole("combobox", { name: "Driver", exact: true }),
    );
    await captureForReview(page, "combobox-assign-driver");
  });

  test("the edit-vehicle picker is an overlay", async ({ page }) => {
    await gotoMap(page);
    await openDrawer(page);
    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: /^Edit / });
    await expect(dialog).toBeVisible();

    await expectPickerOverlay(
      page,
      dialog.getByRole("combobox", { name: "Driver", exact: true }),
    );
    await captureForReview(page, "combobox-edit-vehicle");
  });
});

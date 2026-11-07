import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectTouchTargets,
} from "./helpers";

const VEHICLE_1 = "4324a768-9b14-4223-a299-eb8da4d8d309";
const VEHICLE_2 = "6c69032e-b802-447e-8f7a-ad8c0ddc2359";
const PLATE_2 = "LSD-101-AA";

function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 1024;
}

function drawer(page: Page) {
  return isMobile(page)
    ? page.getByTestId("vehicle-detail-sheet")
    : page.getByTestId("drawer");
}

async function gotoMap(page: Page, search = ""): Promise<void> {
  await page.goto(`/map?map=fake${search ? `&${search}` : ""}`);
  await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), { timeout: 15_000 })
    .toBe(true);
}

async function gotoDrawer(page: Page, vehicleId = VEHICLE_2): Promise<void> {
  await gotoMap(page, `v=${vehicleId}`);
  await expect(drawer(page)).toBeVisible();
}

async function setRole(page: Page, role: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockRole", value);
  }, role);
}

async function openListSheet(page: Page): Promise<void> {
  if (!isMobile(page)) return;
  const handle = page.getByRole("button", { name: /Showing \d+ of \d+/ });
  if ((await handle.getAttribute("aria-expanded")) === "false") await handle.click();
}

test.describe("vehicle drawer", () => {
  test("a deep link opens the drawer before the map is ready", async ({ page }) => {
    await page.goto(`/map?map=fake&v=${VEHICLE_2}`);
    await expect(drawer(page)).toBeVisible();
    await expect(drawer(page)).toContainText(PLATE_2);
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.selectedKey))
      .toBe("demo-imei-0002");
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), { timeout: 15_000 })
      .toBe(true);

    await expect(page.getByRole("heading", { name: "Current state" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trip" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Driver" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vehicle details", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent events" })).toBeVisible();
    await captureForReview(page, "03-drawer-default");
    await expectNoAxeViolations(page);
  });

  test("shows the trip, driver and every event shape with readable evidence", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await gotoDrawer(page);

    await expect(drawer(page).getByText("Refinery Gate").first()).toBeVisible();
    await expect(drawer(page).getByText("Chinedu Musa")).toBeVisible();
    await expect(
      drawer(page).getByRole("link", { name: "08031000001" }),
    ).toHaveAttribute("href", "tel:08031000001");

    await expect(drawer(page).getByText("Route deviation").first()).toBeVisible();
    await expect(drawer(page).getByText("Geofence entry").first()).toBeVisible();
    await expect(drawer(page).getByText("Geofence exit").first()).toBeVisible();

    await drawer(page).getByRole("button", { name: "Show evidence" }).first().click();
    await expect(drawer(page).getByText("2091.58 m")).toBeVisible();
    await expect(drawer(page).getByText("Distance m")).toBeVisible();
    await captureForReview(page, "03-drawer-events-expanded");

    await drawer(page).getByRole("button", { name: `Copy plate ${PLATE_2}` }).click();
    await expect(page.getByText("Plate copied").first()).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(PLATE_2);
  });

  test("a row opens the drawer, Escape closes it and focus returns to the row", async ({
    page,
  }) => {
    const id = VEHICLE_2;
    await gotoMap(page);
    await openListSheet(page);
    const row = page.getByRole("button", { name: `Select ${PLATE_2}` });
    await row.click();

    await expect(page).toHaveURL(new RegExp(`v=${id}`));
    await expect(drawer(page)).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.selectedKey))
      .toBe("demo-imei-0002");

    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/v=/);
    await expect(drawer(page)).toHaveCount(0);

    await expect(row).toBeFocused();
  });

  test("editing sends the change and updates the drawer", async ({ page }) => {
    await gotoDrawer(page);
    await drawer(page).getByRole("button", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog", { name: `Edit ${PLATE_2}` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Plate")).toHaveValue(PLATE_2);
    await captureForReview(page, "03-drawer-edit");

    await dialog.getByLabel("Plate").fill("LSD-101-AB");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Vehicle updated.").first()).toBeVisible();
    await expect(
      drawer(page).getByRole("button", { name: "Copy plate LSD-101-AB" }),
    ).toBeVisible();
    await expect(drawer(page).getByRole("button", { name: "Edit" })).toBeFocused();

    const writes = await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? []);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.method).toBe("PATCH");
    expect(writes[0]?.body).toEqual({ plate: "LSD-101-AB" });
  });

  test("a write-only device field is accepted and still shows a dash", async ({ page }) => {
    await gotoDrawer(page);
    await drawer(page).getByRole("button", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog", { name: `Edit ${PLATE_2}` });
    await dialog.getByLabel("SIM number").fill("892340000000001");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Vehicle updated.").first()).toBeVisible();
    const simRow = drawer(page)
      .locator("dl > div")
      .filter({ hasText: "SIM number" });
    await expect(simRow).toContainText("—");
    await expect(
      drawer(page).getByText("Device fields aren't returned by the API."),
    ).toBeVisible();
    const writes = await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? []);
    expect(writes.at(-1)?.body).toEqual({ sim_number: "892340000000001" });
  });

  test("the detail sheet keeps its header on a 360x640 screen", async ({ page }) => {
    test.skip(!isMobile(page), "mobile only");
    await page.setViewportSize({ width: 360, height: 640 });
    await gotoDrawer(page);

    const sheet = drawer(page);
    const headerBox = await sheet.getByTestId("detail-sheet-header").boundingBox();
    if (!headerBox) throw new Error("detail header has no box");
    expect(headerBox.y).toBeGreaterThanOrEqual(48);
    expect(headerBox.y + headerBox.height).toBeLessThanOrEqual(640);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test("closing a full detail sheet releases the inert map controls", async ({ page }) => {
    test.skip(!isMobile(page), "mobile-only sheet");
    await gotoMap(page);
    await openListSheet(page);
    await page.getByRole("button", { name: `Select ${PLATE_2}` }).click();

    const sheet = drawer(page);
    const handle = sheet.getByRole("button", { name: new RegExp(`^${PLATE_2}`) });
    await handle.focus();
    await page.keyboard.press("End");
    await expect(sheet).toHaveAttribute("data-snap", "full");

    const controls = page.locator('fieldset[aria-label="Map controls"]');
    await expect(controls).toHaveAttribute("inert");

    await sheet.getByRole("button", { name: "Close vehicle details" }).click();
    await expect(page.getByRole("button", { name: /Showing 25 of 25/ })).toBeVisible();
    await expect(controls).not.toHaveAttribute("inert");
  });

  test("the panel shortcut explains itself instead of changing a hidden preference", async ({
    page,
  }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, "desktop widths only");
    await page.setViewportSize({ width: 1024, height: 900 });
    await gotoDrawer(page);

    const before = await page.evaluate(() => localStorage.getItem("fleet.map.panel"));
    await page.keyboard.press("[");
    await expect(page.getByText("Close the vehicle drawer to show the list.")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("fleet.map.panel"))).toBe(before);
  });

  test("assigning a driver updates the drawer and cannot unassign", async ({ page }) => {
    await gotoDrawer(page);
    await drawer(page).getByRole("button", { name: "Assign driver" }).click();

    const dialog = page.getByRole("dialog", { name: `Assign a driver to ${PLATE_2}` });
    await expect(dialog).toBeVisible();
    await captureForReview(page, "03-drawer-assign");

    const driver = dialog.getByRole("combobox", { name: "Driver" });
    await driver.click();
    await driver.fill("08031000002");
    await dialog.getByText("08031000002 · LIC-01002").click();
    await expect(dialog.getByRole("button", { name: "Assign driver" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Assign driver" }).click();

    await expect(page.getByText("Driver assigned.").first()).toBeVisible();
    await expect(drawer(page).getByText("Musa Balogun")).toBeVisible();
  });

  test("a viewer sees disabled edit and assign actions with a reason", async ({ page }) => {
    await setRole(page, "viewer");
    await gotoDrawer(page);

    const edit = drawer(page).getByRole("button", { name: "Edit" });
    const assign = drawer(page).getByRole("button", { name: "Assign driver" });
    await expect(edit).toHaveAttribute("aria-disabled", "true");
    await expect(assign).toHaveAttribute("aria-disabled", "true");

    await edit.focus();
    await expect(page.getByText("Your role can't edit vehicles.")).toBeVisible();
    await edit.dispatchEvent("click");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a live position updates the current state and an older frame is ignored", async ({
    page,
    liveSocket,
  }) => {
    await gotoDrawer(page);
    await liveSocket.wait();

    await liveSocket.send({
      type: "position",
      tenant_id: "tenant-demo",
      vehicle_id: "demo-imei-0002",
      lat: 6.11111,
      lon: 3.22222,
      recorded_at: new Date().toISOString(),
    });
    await expect(
      drawer(page).getByRole("button", { name: /Copy coordinates 6\.11111, 3\.22222/ }),
    ).toBeVisible();

    await liveSocket.send({
      type: "position",
      tenant_id: "tenant-demo",
      vehicle_id: "demo-imei-0002",
      lat: 1.11111,
      lon: 1.22222,
      recorded_at: "2020-01-01T00:00:00Z",
    });
    await page.waitForTimeout(300);
    await expect(
      drawer(page).getByRole("button", { name: /Copy coordinates 6\.11111, 3\.22222/ }),
    ).toBeVisible();
  });

  test("the mobile detail sheet snaps, contains its header and returns the list", async ({
    page,
  }) => {
    test.skip(!isMobile(page), "mobile-only sheet");
    await gotoMap(page);
    await openListSheet(page);
    await page.getByRole("button", { name: `Select ${PLATE_2}` }).click();

    const sheet = drawer(page);
    await expect(sheet).toHaveAttribute("data-snap", "half");
    const headerBox = await sheet.getByTestId("detail-sheet-header").boundingBox();
    if (!headerBox) throw new Error("detail header has no box");
    expect(Math.round(headerBox.height)).toBe(113);
    await captureForReview(page, "03-detail-sheet-half");

    const handle = sheet.getByRole("button", { name: new RegExp(`^${PLATE_2}`) });
    await handle.focus();
    await page.keyboard.press("End");
    await expect(sheet).toHaveAttribute("data-snap", "full");
    await expect(sheet.getByTestId("detail-sheet-content")).not.toHaveAttribute("inert");
    await expect(page.getByText("Active trips")).toHaveCount(0);
    await expect(
      page.locator('fieldset[aria-label="Map controls"]'),
    ).toHaveAttribute("inert");
    await expect(page.getByTestId("map-attribution")).toBeVisible();
    await captureForReview(page, "03-detail-sheet-full");

    const fullBox = await sheet.boundingBox();
    if (!fullBox) throw new Error("sheet has no box");
    expect(fullBox.y).toBeGreaterThanOrEqual(128);
    expect(fullBox.y + fullBox.height).toBeLessThanOrEqual(844);

    await page.keyboard.press("Home");
    await expect(sheet).toHaveAttribute("data-snap", "peek");
    await expect(sheet.getByTestId("detail-sheet-content")).toHaveAttribute("inert");
    const peekBox = await sheet.boundingBox();
    if (!peekBox) throw new Error("sheet has no box");
    expect(peekBox.y).toBeGreaterThanOrEqual(48);
    expect(peekBox.y + peekBox.height).toBeLessThanOrEqual(844);
    await captureForReview(page, "03-detail-sheet-peek");

    await page.keyboard.press("ArrowUp");
    await expect(sheet).toHaveAttribute("data-snap", "half");
    await expectNoOverlap(page.locator('fieldset[aria-label="Map controls"]'), sheet);
    await expectNoOverlap(page.getByTestId("map-attribution"), sheet);
    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page, 44);
    await expectNoAxeViolations(page);

    await sheet.getByRole("button", { name: "Close vehicle details" }).click();
    await expect(page.getByRole("button", { name: /Showing 25 of 25/ })).toBeVisible();
  });

  test("centre on map closes over the drawer with the drawer-aware padding", async ({
    page,
  }) => {
    await gotoDrawer(page, VEHICLE_1);
    await drawer(page).getByRole("button", { name: "Centre on map" }).click();
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.selectedKey))
      .toBe("demo-imei-0001");

    if (isMobile(page)) {
      await expect(drawer(page)).toHaveAttribute("data-snap", "peek");
    }
  });
});

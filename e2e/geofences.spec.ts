import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./helpers";

async function gotoGeofences(page: Page, search = ""): Promise<void> {
  await page.goto(`/geofences?map=fake${search ? `&${search}` : ""}`);
  await expect(page.getByRole("heading", { name: "Geofences" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("geofences-page")).toContainText("4 geofences");
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), {
      timeout: 15_000,
    })
    .toBe(true);
}

function row(page: Page, name: string) {
  return page
    .getByRole("list", { name: "Geofences" })
    .getByRole("button", { name: new RegExp(name) });
}

async function lastWrite(page: Page) {
  return page.evaluate(() => window.__FLEET_MOCK_WRITES__?.at(-1));
}

async function editor(page: Page, name: "New geofence" | "Edit geofence") {
  const form = page.getByRole("form", { name });
  await expect(form).toBeVisible();
  return form;
}

async function clickMapPoint(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId("fleet-map-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("map canvas has no box");
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
}

async function drawTriangle(page: Page): Promise<void> {
  await expect(page.getByText("Draw a polygon on the map to continue.")).toBeVisible({
    timeout: 15_000,
  });
  await clickMapPoint(page, 0.35, 0.4);
  await clickMapPoint(page, 0.55, 0.4);
  await clickMapPoint(page, 0.45, 0.58);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Polygon ready.")).toBeVisible();
}

test.describe("geofences", () => {
  test("lists geofences, selects one and restores the URL", async ({ page }) => {
    await gotoGeofences(page);
    await expect(page.getByRole("list", { name: "Geofences" })).toBeVisible();
    await expect(row(page, "Border")).toBeVisible();
    await expect(row(page, "Ibadan Customer")).toBeVisible();
    await expect(page.getByText("Select a geofence to edit.")).toBeVisible();
    await captureForReview(page, "08-geofences-list");
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    await row(page, "Border").click();
    await expect(page).toHaveURL(/selected=/);
    await expect(page.getByTestId("geofences-page")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(row(page, "Border")).toHaveAttribute("aria-current", "true");
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.selectedKey))
      .toBeTruthy();
    await captureForReview(page, "08-geofences-selected");
    await expectNoAxeViolations(page);

    const reloadUrl = new URL(page.url());
    reloadUrl.searchParams.set("map", "fake");
    await page.goto(reloadUrl.toString());
    await expect(row(page, "Border")).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  });

  test("filters the list client-side and explains no results", async ({ page }) => {
    await gotoGeofences(page);
    const search = page.getByRole("searchbox", { name: "Search geofences" });
    await search.fill("lekki");
    await expect(page).toHaveURL(/q=lekki/);
    await expect(page.getByTestId("geofences-page")).toContainText("1 of 4");
    await expect(row(page, "Lekki Depot")).toBeVisible();
    await expect(row(page, "Border")).toHaveCount(0);
    await captureForReview(page, "08-geofences-filtered");

    await search.fill("airport");
    await expect(page.getByText('No geofences match "airport".', { exact: false })).toBeVisible();
    await captureForReview(page, "08-geofences-no-results");
    await page.getByRole("button", { name: "Clear search" }).first().click();
    await expect(page.getByTestId("geofences-page")).toContainText("4 geofences");
  });

  test("selects a polygon on the map and clears a hiding search", async ({ page }) => {
    await gotoGeofences(page, "q=border");
    const viewport = await page.evaluate(() =>
      window.__FLEET_TEST_MAP__?.getViewport(),
    );
    const canvas = page.getByTestId("fleet-map-canvas");
    const box = await canvas.boundingBox();
    if (!viewport || !box) throw new Error("map has no viewport");
    const { bounds } = viewport;
    const lon = 3.48;
    const lat = 6.4375;
    const x = box.x + ((lon - bounds.west) / (bounds.east - bounds.west)) * box.width;
    const y = box.y + ((bounds.north - lat) / (bounds.north - bounds.south)) * box.height;
    await page.mouse.click(x, y);

    await expect(page).toHaveURL(/selected=00000000-0000-0000-0000-000000000202/);
    await expect(page).not.toHaveURL(/q=/);
    await expect(row(page, "Lekki Depot")).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("searchbox", { name: "Search geofences" })).toHaveValue("");
  });

  test("creates a geofence by drawing a polygon", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoGeofences(page);
    await page.getByRole("button", { name: "Create geofence" }).click();
    const form = await editor(page, "New geofence");

    await drawTriangle(page);
    await captureForReview(page, "08-geofences-create");
    await form.getByLabel("Name").fill("  New Gate ");
    await form.getByLabel("Kind").selectOption("customer");
    await form.getByRole("button", { name: "Create geofence" }).click();

    await expect(page.getByText("Geofence created.").first()).toBeVisible();
    const write = await lastWrite(page);
    expect(write).toMatchObject({ method: "POST", url: "/api/v1/geofences" });
    const body = write?.body as {
      name: string;
      kind: string;
      geometry: { type: string; coordinates: number[][][] };
    };
    expect(body.name).toBe("New Gate");
    expect(body.kind).toBe("customer");
    expect(body.geometry.type).toBe("Polygon");
    const ring = body.geometry.coordinates[0] ?? [];
    expect(ring.length).toBeGreaterThanOrEqual(4);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const [lon, lat] of ring) {
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
    }

    const created = row(page, "New Gate");
    await expect(created).toBeVisible();
    await expect(created).toHaveAttribute("aria-current", "true");
    await expect(created).toBeFocused();
    await expect(page.getByTestId("geofences-page")).toContainText("5 geofences");
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.geofenceCount))
      .toBe(5);
    await expectNoAxeViolations(page);
  });

  test("edits a name only, then a kind and geometry", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoGeofences(page);
    await row(page, "Border").click();
    await page.getByRole("button", { name: "Edit" }).click();
    const form = await editor(page, "Edit geofence");
    await form.getByLabel("Name").fill("Border North");
    await form.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Geofence updated.").first()).toBeVisible();
    let write = await lastWrite(page);
    expect(write).toMatchObject({ method: "PATCH", body: { name: "Border North" } });
    expect(Object.keys((write?.body as object) ?? {})).toEqual(["name"]);

    await row(page, "Border North").click();
    await page.getByRole("button", { name: "Edit" }).click();
    const second = await editor(page, "Edit geofence");
    await second.getByLabel("Kind").selectOption("customer");
    await page.evaluate(() => {
      window.__FLEET_TEST_MAP__?.draw?.testSetRing?.([
        [3.0, 7.7],
        [3.2, 7.7],
        [3.2, 7.9],
        [3.0, 7.7],
      ]);
    });
    await second.getByRole("button", { name: "Save changes" }).click();
    await expect(second).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_MOCK_WRITES__?.length ?? 0))
      .toBe(2);
    write = await lastWrite(page);
    const body = write?.body as { kind?: string; geometry?: { coordinates: number[][][] } };
    expect(body.kind).toBe("customer");
    expect(body.geometry?.coordinates[0]?.[0]).toEqual([3.0, 7.7]);
    expect(write?.body).not.toHaveProperty("name");
  });

  test("discards a dirty edit without writing", async ({ page }) => {
    await gotoGeofences(page);
    await row(page, "Border").click();
    await page.getByRole("button", { name: "Edit" }).click();
    const form = await editor(page, "Edit geofence");
    await form.getByLabel("Name").fill("Draft name");
    await form.getByRole("button", { name: "Cancel" }).click();
    const discard = page.getByRole("dialog", { name: "Discard changes?" });
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect(form).toBeVisible();

    await form.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("dialog", { name: "Discard changes?" })
      .getByRole("button", { name: "Discard" })
      .click();
    await expect(page.getByRole("list", { name: "Geofences" })).toBeVisible();
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(0);
  });

  test("deletes a free geofence and refuses one with events", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoGeofences(page);
    await row(page, "Border").click();
    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("dialog", { name: 'Delete geofence "Border"?' });
    await expect(dialog).toBeVisible();
    await captureForReview(page, "08-geofences-delete");
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Geofence deleted.").first()).toBeVisible();
    await expect(row(page, "Border")).toHaveCount(0);
    expect(await lastWrite(page)).toMatchObject({ method: "DELETE" });
    await expect(page.getByTestId("geofences-page")).toContainText("3 geofences");

    await row(page, "Refinery Gate").click();
    await page.getByRole("button", { name: "Delete" }).click();
    const blocked = page.getByRole("dialog", { name: 'Delete geofence "Refinery Gate"?' });
    await blocked.getByRole("button", { name: "Delete" }).click();
    await expect(
      blocked.getByText("This geofence has recorded events and can't be deleted."),
    ).toBeVisible();
    await expect(blocked.getByText("geofence has events and cannot be deleted")).toBeVisible();
    await expect(blocked.getByRole("button", { name: "Delete" })).toBeDisabled();
    await captureForReview(page, "08-geofences-delete-409");
    await expectNoAxeViolations(page);
    await blocked.getByRole("button", { name: "Cancel" }).click();
    await expect(row(page, "Refinery Gate")).toBeVisible();
  });

  test("viewers and security read but cannot create, edit or delete", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fleet.mockRole", "viewer");
    });
    await gotoGeofences(page);
    await expect(page.getByRole("button", { name: "Create geofence" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await page.getByRole("button", { name: "Create geofence" }).click({ force: true });
    await expect(page.getByRole("form", { name: "New geofence" })).toHaveCount(0);

    await row(page, "Border").click();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(page.getByRole("button", { name: "Delete" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await page.getByRole("button", { name: "Delete" }).click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(0);
  });

  test("shows the empty state and a deep link to a missing geofence", async ({ page }) => {
    await page.goto("/geofences?map=fake&empty=geofences");
    await expect(page.getByText("No geofences yet")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Draw the first one to start tracking zone events.")).toBeVisible();
    await captureForReview(page, "08-geofences-empty");
    await expectNoAxeViolations(page);

    await gotoGeofences(page, "selected=does-not-exist");
    await expect(page.getByText("This geofence no longer exists.")).toBeVisible();
    await captureForReview(page, "08-geofences-not-found");
    await page.getByRole("button", { name: "Clear selection" }).click();
    await expect(page).not.toHaveURL(/selected=/);
  });
});

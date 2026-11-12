import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  primeOfflineSession,
} from "./helpers";

const ADEBAYO = "5b77edaf-c0c6-4ba4-b0c7-d2b6422c598d";
const ADEBAYO_VEHICLE = "4324a768-9b14-4223-a299-eb8da4d8d309";
const ZERO_VEHICLE_DRIVER = "c7d3e3a6-0b6e-4f2c-9a4e-2b1f6f2d8e19";

async function gotoDrivers(page: Page, search = ""): Promise<void> {
  await page.goto(`/drivers${search ? `?${search}` : ""}`);
  await expect(page.getByRole("heading", { name: "Drivers" })).toBeVisible({
    timeout: 15_000,
  });
}

function row(page: Page, name: string) {
  return page.getByRole("row").filter({ hasText: name });
}

async function lastWrite(
  page: Page,
): Promise<{ method: string; url: string; body: unknown } | undefined> {
  return page.evaluate(() => window.__FLEET_MOCK_WRITES__?.at(-1));
}

async function openDrawer(page: Page, name: string, detail: string): Promise<void> {
  await page.getByRole("button", { name: new RegExp(`Open driver ${name}, ${detail}`) }).click();
  await expect(page.getByRole("complementary", { name: "Driver details" })).toBeVisible();
}

test.describe("drivers", () => {
  test("creates, edits and deactivates a driver with confirmation", async ({ page }) => {
    test.setTimeout(90_000);
    await gotoDrivers(page);
    await expect(page.getByTestId("drivers-page")).toContainText("26 drivers");
    await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Vehicles" })).toBeVisible();
    await captureForReview(page, "07-drivers-list");
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    await page.getByRole("button", { name: "Create driver" }).click();
    const create = page.getByRole("dialog", { name: "Create driver" });
    await expect(create).toBeVisible();
    await create.getByLabel("Name").fill("  Ada Obi  ");
    await create.getByLabel("Phone (optional)").fill("0803 100 0111");
    await captureForReview(page, "07-drivers-create");
    await create.getByRole("button", { name: "Create driver" }).click();

    await expect(page.getByText("Driver created.").first()).toBeVisible();
    const createWrite = await lastWrite(page);
    expect(createWrite).toMatchObject({
      method: "POST",
      url: "/api/v1/drivers",
      body: { name: "Ada Obi", phone: "0803 100 0111" },
    });
    expect(createWrite?.body).not.toHaveProperty("licence");

    const ada = row(page, "Ada Obi");
    await expect(ada).toContainText("Active");
    await expect(ada).toContainText("0");
    await expect(page.getByTestId("drivers-page")).toContainText("27 drivers");

    await openDrawer(page, "Ada Obi", "0803 100 0111");
    const drawer = page.getByRole("complementary", { name: "Driver details" });
    await expect(drawer.getByText("No vehicles assigned.")).toBeVisible();
    await captureForReview(page, "07-drivers-drawer");

    await drawer.getByRole("button", { name: "Edit driver" }).click();
    const edit = page.getByRole("dialog", { name: "Edit driver" });
    await expect(edit).toBeVisible();
    await expect(edit.getByText("No changes to save.")).toBeVisible();
    await edit.getByLabel("Phone").fill("0803 100 0112");
    await captureForReview(page, "07-drivers-edit");
    await edit.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Driver updated.").first()).toBeVisible();
    const editWrite = await lastWrite(page);
    expect(editWrite).toMatchObject({ method: "PATCH", body: { phone: "0803 100 0112" } });
    expect(Object.keys((editWrite?.body as object) ?? {})).toEqual(["phone"]);
    await expect(drawer.getByRole("link", { name: "0803 100 0112" })).toBeVisible();
    await drawer.getByRole("button", { name: "Close driver details" }).click();

    await openDrawer(page, "Adebayo Okafor", "08031000000 · LIC-01000");
    await page.getByRole("complementary", { name: "Driver details" })
      .getByRole("button", { name: "Edit driver" })
      .click();
    const deactivateEdit = page.getByRole("dialog", { name: "Edit driver" });
    await deactivateEdit.getByLabel("Status").selectOption("inactive");
    await deactivateEdit.getByRole("button", { name: "Save changes" }).click();

    const confirm = page.getByRole("dialog", { name: "Deactivate Adebayo Okafor?" });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText("is assigned to 1 vehicle.");
    await captureForReview(page, "07-drivers-deactivate");
    await expectNoAxeViolations(page);
    await confirm.getByRole("button", { name: "Keep active" }).click();
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(2);

    await deactivateEdit.getByRole("button", { name: "Save changes" }).click();
    await page
      .getByRole("dialog", { name: "Deactivate Adebayo Okafor?" })
      .getByRole("button", { name: "Deactivate driver" })
      .click();

    await expect(page.getByText("Driver deactivated.").first()).toBeVisible();
    const deactivateWrite = await lastWrite(page);
    expect(deactivateWrite).toMatchObject({ method: "PATCH", body: { status: "inactive" } });
    const inactiveDrawer = page.getByRole("complementary", { name: "Driver details" });
    await expect(inactiveDrawer).toContainText("Inactive");
    await expect(inactiveDrawer.getByRole("link", { name: "LSD-100-AA" })).toBeVisible();
    await expect(inactiveDrawer).toContainText("Inactive drivers keep their current vehicle assignments.");

    await inactiveDrawer.getByRole("button", { name: "Edit driver" }).click();
    const reactivate = page.getByRole("dialog", { name: "Edit driver" });
    await reactivate.getByLabel("Status").selectOption("active");
    await reactivate.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Driver activated.").first()).toBeVisible();
    expect(await lastWrite(page)).toMatchObject({ method: "PATCH", body: { status: "active" } });
    await expect(page.getByRole("complementary", { name: "Driver details" })).toContainText("Active");
    await page.getByRole("button", { name: "Close driver details" }).click();

    await openDrawer(page, "Test Driver Six", "no contact details");
    const zeroDrawer = page.getByRole("complementary", { name: "Driver details" });
    await zeroDrawer.getByRole("button", { name: "Edit driver" }).click();
    const zeroEdit = page.getByRole("dialog", { name: "Edit driver" });
    await zeroEdit.getByLabel("Status").selectOption("active");
    await zeroEdit.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Driver activated.").first()).toBeVisible();
    await expect(page.getByRole("dialog", { name: /Deactivate/ })).toHaveCount(0);
    expect(await lastWrite(page)).toMatchObject({ method: "PATCH", body: { status: "active" } });

    await zeroDrawer.getByRole("button", { name: "Edit driver" }).click();
    const zeroDeactivate = page.getByRole("dialog", { name: "Edit driver" });
    await zeroDeactivate.getByLabel("Status").selectOption("inactive");
    await zeroDeactivate.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Driver deactivated.").first()).toBeVisible();
    await expect(page.getByRole("dialog", { name: /Deactivate/ })).toHaveCount(0);
    expect(await lastWrite(page)).toMatchObject({ method: "PATCH", body: { status: "inactive" } });
  });

  test("round-trips search, status and the selected driver through the URL", async ({ page }) => {
    await gotoDrivers(page);
    const requests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/v1/drivers") requests.push(request.url());
    });

    await page.getByLabel("Search drivers").fill("adebayo");
    await expect(page).toHaveURL(/q=adebayo/);
    await expect(page.getByTestId("drivers-page")).toContainText("2 of 26 drivers");
    expect(requests).toHaveLength(0);

    await page.getByLabel("Search drivers").fill("08031000001");
    await expect(page.getByTestId("drivers-page")).toContainText("1 of 26 drivers");
    await expect(row(page, "Chinedu Musa")).toHaveCount(1);

    await page.getByLabel("Search drivers").fill("lic01010");
    await expect(row(page, "Adebayo Okafor")).toHaveCount(1);
    expect(requests).toHaveLength(0);

    await page.getByLabel("Search drivers").fill("NO-SUCH-DRIVER");
    await expect(page.getByText("No drivers match")).toBeVisible();
    await expect(page.getByText("Try a different search or clear the filters.")).toBeVisible();
    await captureForReview(page, "07-drivers-no-results");
    await expectNoAxeViolations(page);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByTestId("drivers-page")).toContainText("26 drivers");

    await page.getByLabel("Status").selectOption("inactive");
    await expect(page).toHaveURL(/status=inactive/);
    await expect(page.getByTestId("drivers-page")).toContainText("1 of 26 drivers");
    await expect(row(page, "Test Driver Six")).toBeVisible();

    await page.getByRole("button", { name: /Open driver Test Driver Six/ }).click();
    await expect(page).toHaveURL(new RegExp(`driver=${ZERO_VEHICLE_DRIVER}`));

    await page.reload();
    await expect(page.getByRole("heading", { name: "Drivers" })).toBeVisible();
    await expect(page.getByLabel("Status")).toHaveValue("inactive");
    await expect(page.getByRole("complementary", { name: "Driver details" })).toContainText(
      "Test Driver Six",
    );

    await page.getByRole("button", { name: "Close driver details" }).click();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page).not.toHaveURL(/status=|q=/);
    await expect(page.getByTestId("drivers-page")).toContainText("26 drivers");
  });

  test("opens the drawer from a row, links a vehicle and returns focus on close", async ({
    page,
  }) => {
    test.skip((page.viewportSize()?.width ?? 1440) < 1024, "desktop-only layout");
    await gotoDrivers(page);
    const origin = page.getByRole("button", {
      name: /Open driver Adebayo Okafor, 08031000000 · LIC-01000/,
    });
    await origin.click();

    const drawer = page.getByRole("complementary", { name: "Driver details" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "08031000000" })).toHaveAttribute(
      "href",
      "tel:08031000000",
    );
    await expect(drawer.getByRole("button", { name: "Copy licence LIC-01000" })).toBeVisible();
    await expect(drawer.getByRole("button", { name: `Copy driver id ${ADEBAYO}` })).toBeVisible();
    await expect(drawer.getByRole("link", { name: "LSD-100-AA" })).toBeVisible();
    await expectNoAxeViolations(page);

    await drawer.getByRole("link", { name: "LSD-100-AA" }).click();
    await expect(page).toHaveURL(new RegExp(`/map\\?v=${ADEBAYO_VEHICLE}`));
    await page.goBack();
    await expect(page.getByRole("complementary", { name: "Driver details" })).toBeVisible();

    await page.getByRole("button", { name: "Close driver details" }).focus();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("complementary", { name: "Driver details" })).toHaveCount(0);
    await expect(origin).toBeFocused();
  });

  test("opens a deep-linked driver and explains an unknown one", async ({ page }) => {
    await gotoDrivers(page, `driver=${ADEBAYO}`);
    const drawer = page.getByRole("complementary", { name: "Driver details" });
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    await expect(drawer).toContainText("Adebayo Okafor");
    await expect(drawer).toContainText("LSD-100-AA");
    await expectNoAxeViolations(page);

    await gotoDrivers(page, "driver=does-not-exist");
    await expect(page.getByText("Driver not found")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("It may have been removed.")).toBeVisible();
    await captureForReview(page, "07-drivers-not-found");
    await page.getByRole("button", { name: "Back to drivers" }).click();
    await expect(page).not.toHaveURL(/driver=/);
  });

  test("viewers and security read the list but cannot create or edit", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fleet.mockRole", "viewer");
    });
    await gotoDrivers(page);
    await expect(page.getByTestId("drivers-page")).toContainText("26 drivers");
    const create = page.getByRole("button", { name: "Create driver" });
    await expect(create).toHaveAttribute("aria-disabled", "true");
    await create.click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await openDrawer(page, "Test Driver Six", "no contact details");
    const edit = page
      .getByRole("complementary", { name: "Driver details" })
      .getByRole("button", { name: "Edit driver" });
    await expect(edit).toHaveAttribute("aria-disabled", "true");
    await edit.click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(0);

    await page.addInitScript(() => {
      localStorage.setItem("fleet.mockRole", "security");
    });
    await gotoDrivers(page);
    await expect(page.getByRole("button", { name: "Create driver" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  test("shows the no-data empty state", async ({ page }) => {
    await gotoDrivers(page, "empty=drivers");
    await expect(page.getByText("No drivers yet")).toBeVisible();
    await expect(page.getByText("Create the first one.")).toBeVisible();
    await expect(page.getByText("No drivers match")).toHaveCount(0);
    await captureForReview(page, "07-drivers-no-data");
    await expectNoAxeViolations(page);
  });

  test("recovers from a first-load server error", async ({ page }) => {
    await gotoDrivers(page, "fault=drivers%3Aserver");
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 15_000,
    });
    await captureForReview(page, "07-drivers-error");
    await expectNoAxeViolations(page);

    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("fault");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await page.getByRole("button", { name: "Retry" }).first().click();
    await expect(page.getByTestId("drivers-page")).toContainText("26 drivers", {
      timeout: 15_000,
    });
  });

  test("keeps cached rows and labels a failed refresh", async ({ page }) => {
    await gotoDrivers(page);
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "drivers:server");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await page.evaluate(() => {
      window.dispatchEvent(new Event("visibilitychange"));
    });

    await expect(page.getByText("Couldn't refresh")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Stale ·/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Open driver Adebayo Okafor/ }).first()).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("offline keeps cached rows, marks them stale and disables writes", async ({
    page,
    context,
  }) => {
    await gotoDrivers(page);
    await expect(page.getByTestId("drivers-page")).toContainText("26 drivers");

    await context.setOffline(true);
    await expect(page.getByText("You're offline", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Stale ·/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Create driver" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(
      page.getByRole("button", { name: /Open driver Adebayo Okafor/ }).first(),
    ).toBeVisible();
    await captureForReview(page, "07-drivers-offline");
    await expectNoAxeViolations(page);
    await context.setOffline(false);
  });

  test("offline with no cache shows the neutral empty state", async ({ page }) => {
    await primeOfflineSession(page);
    await page.goto("/drivers?fault=drivers%3Anetwork");

    await expect(page.getByText("You're offline")).toBeVisible();
    await expect(page.getByText("No drivers available offline")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("No drivers yet")).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test("an offline deep link is neutral instead of claiming removal", async ({ page }) => {
    await primeOfflineSession(page);
    await page.goto(`/drivers?driver=${ADEBAYO}&fault=drivers%3Anetwork`);

    const drawer = page.getByRole("complementary", { name: "Driver details" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("This driver isn't available offline")).toBeVisible({
      timeout: 15_000,
    });
    await expect(drawer.getByText("Driver not found")).toHaveCount(0);
    await expectNoAxeViolations(page);
    await captureForReview(page, "07-drivers-offline-deeplink");
  });
});

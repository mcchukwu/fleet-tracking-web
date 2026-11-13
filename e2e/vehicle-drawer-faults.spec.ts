import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations, expectNoHorizontalScroll } from "./helpers";

const VEHICLE_2 = "6c69032e-b802-447e-8f7a-ad8c0ddc2359";
const PLATE_2 = "LSD-101-AA";

function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 1024;
}

function drawer(page: Page) {
  return isMobile(page) ? page.getByTestId("vehicle-detail-sheet") : page.getByTestId("drawer");
}

async function gotoFault(page: Page, fault: string): Promise<void> {
  await page.goto(`/map?map=fake&v=${VEHICLE_2}&fault=${fault}`);
  await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
  await expect(drawer(page)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), { timeout: 15_000 })
    .toBe(true);
}

test.describe("vehicle drawer faults", { tag: "@fault" }, () => {
  test("a detail server error keeps the live row, disables writes and offers Retry", async ({
    page,
  }) => {
    await gotoFault(page, "vehicle:server");
    // The query retries twice before the error surface appears.
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(drawer(page).getByText("48 km/h")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    await expect(drawer(page).getByRole("button", { name: "Edit" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(drawer(page).getByRole("button", { name: "Assign driver" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(drawer(page).getByRole("button", { name: "Centre on map" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await captureForReview(page, "03-drawer-detail-error");
  });

  test("a forbidden detail shows the forbidden state", async ({ page }) => {
    await gotoFault(page, "vehicle:forbidden");
    await expect(page.getByText("You don't have access to this.")).toBeVisible();
    await expect(drawer(page).getByRole("button", { name: "Close", exact: true })).toBeVisible();
    await captureForReview(page, "03-drawer-forbidden");
  });

  test("a conflict offers a refresh that loads the latest record", async ({ page }) => {
    await page.goto(`/map?map=fake&v=${VEHICLE_2}`);
    await expect(drawer(page)).toBeVisible();
    await drawer(page).getByRole("button", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog", { name: `Edit ${PLATE_2}` });
    await dialog.getByLabel("Plate").fill("LSD-101-AB");
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "vehicle-patch:conflict");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(dialog.getByText("The record changed elsewhere.")).toBeVisible();
    await page.evaluate(async (id) => {
      const url = new URL(window.location.href);
      url.searchParams.delete("fault");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
      await fetch(`/api/v1/vehicles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: "LSD-101-AC" }),
      });
    }, VEHICLE_2);

    await dialog.getByRole("button", { name: "Refresh" }).click();
    const refreshed = page.getByRole("dialog", { name: "Edit LSD-101-AC" });
    await expect(refreshed.getByLabel("Plate")).toHaveValue("LSD-101-AC");
  });

  test("an events failure is contained to the events section", async ({ page }) => {
    await gotoFault(page, "vehicle-events:server");
    await expect(page.getByRole("heading", { name: "Vehicle details", exact: true })).toBeVisible();
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
  });

  test("a removed vehicle replaces the body with a close action", async ({ page }) => {
    await gotoFault(page, "vehicle:not_found");
    await expect(page.getByText("Vehicle not found")).toBeVisible();
    await expect(drawer(page).getByRole("button", { name: "Close", exact: true })).toBeVisible();
    await captureForReview(page, "03-drawer-not-found");
  });

  test("a contract failure names the response, not the server", async ({ page }) => {
    await gotoFault(page, "vehicle:contract");
    await expect(page.getByText("Unexpected response from the server").first()).toBeVisible();
  });

  test("an unknown event enum renders the neutral fallback", async ({ page }) => {
    await gotoFault(page, "vehicle-events:unknown_enum");
    await expect(page.getByText("Unknown event: solar_flare")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vehicle details", exact: true })).toBeVisible();
  });

  test("a drawer render crash is contained by the panel boundary", async ({ page }) => {
    await page.goto(`/map?map=fake&v=${VEHICLE_2}&crash=vehicle-drawer`);
    await expect(page.getByText("This part of the page stopped working")).toBeVisible();
    await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
    if (!isMobile(page)) {
      await expect(page.getByRole("region", { name: "Vehicles" })).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
  });

  test("offline keeps cached detail, marks it stale and disables writes", async ({ page }) => {
    await page.goto(`/map?map=fake&v=${VEHICLE_2}`);
    await expect(drawer(page)).toBeVisible();
    await page.getByTestId("banner-region").waitFor({ state: "attached" });
    await page.evaluate(() => window.__FLEET_TEST_CONNECTION__?.({ network: "offline" }));
    await expect(page.getByTestId("banner-region")).toContainText("You're offline");
    await expect(drawer(page).getByRole("button", { name: "Edit" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(drawer(page).getByRole("button", { name: "Assign driver" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await captureForReview(page, "03-drawer-offline");
    await page.evaluate(() => window.__FLEET_TEST_CONNECTION__?.({ network: "online" }));
  });

  test("a lost write is reconciled and reported as not saved", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`/map?map=fake&v=${VEHICLE_2}`);
    await expect(drawer(page)).toBeVisible();
    await drawer(page).getByRole("button", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog", { name: `Edit ${PLATE_2}` });
    await dialog.getByLabel("Plate").fill("LSD-101-AB");
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "vehicle:lost");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog.getByRole("button", { name: "Save changes" })).toBeDisabled();

    await page.waitForTimeout(1_000);
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("fault");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });

    await expect(page.getByText("It wasn't saved.")).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Plate")).toHaveValue("LSD-101-AB");
  });

  test("a slow detail shows the working state before it resolves", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto(`/map?map=fake&v=${VEHICLE_2}&fault=vehicle:slow`);
    await expect(drawer(page)).toBeVisible();
    await expect(page.getByText("Still working…")).toBeVisible({ timeout: 6_000 });
  });

  test(
    "the drawer is axe clean in its empty and stale states",
    { tag: "@theme" },
    async ({ page }) => {
      await page.goto(`/map?map=fake&v=${VEHICLE_2}`);
      await expect(drawer(page)).toBeVisible();
      await expectNoAxeViolations(page);
    },
  );
});

test.describe("vehicle uncertain writes", { tag: "@fault" }, () => {
  test("a response lost after the edit saved reconciles the drawer", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`/map?map=fake&v=${VEHICLE_2}`);
    await expect(drawer(page)).toBeVisible();
    await drawer(page).getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: `Edit ${PLATE_2}` });
    await dialog.getByLabel("Plate").fill("LSD-101-AD");
    await page.clock.install();
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "vehicle-patch:lost_after_save");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await page.clock.runFor(16_000);

    await expect(page.getByText("It was saved.").first()).toBeVisible({ timeout: 20_000 });
    await expect(drawer(page)).toContainText("LSD-101-AD", { timeout: 20_000 });
  });
});

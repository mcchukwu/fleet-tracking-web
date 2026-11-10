import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./helpers";

const COMPLETED_TRIP = "8aa551e2-f30b-467b-bd96-b85f342032ef";
const COMPLETED_VEHICLE = "4324a768-9b14-4223-a299-eb8da4d8d309";

async function gotoTrips(page: Page, search = ""): Promise<void> {
  await page.goto(`/trips${search ? `?${search}` : ""}`);
  await expect(page.getByRole("heading", { name: "Trips" })).toBeVisible({
    timeout: 15_000,
  });
}

function row(page: Page, plate: string, status?: string) {
  const base = page.getByRole("row").filter({ hasText: plate });
  return status ? base.filter({ hasText: status }) : base;
}

async function lastWrite(page: Page): Promise<{ method: string; url: string; body: unknown } | undefined> {
  return page.evaluate(() => window.__FLEET_MOCK_WRITES__?.at(-1));
}

test.describe("trips", () => {
  test("runs the morning dispatch from planned to completed", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoTrips(page);
    await expect(page.getByTestId("trips-page")).toContainText("5 loaded");
    await expect(page.getByRole("columnheader", { name: "Vehicle" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Distance" })).toBeVisible();
    await captureForReview(page, "06-trips-list");
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    await page.getByRole("button", { name: "Create trip" }).click();
    const create = page.getByRole("dialog").filter({ hasText: "Create trip" });
    await expect(create).toBeVisible();
    await create.getByLabel("Vehicle").click();
    await page.getByRole("option", { name: /LSD-100-AA/ }).first().click();
    await create.getByLabel("Origin").fill("Refinery Gate");
    await create.getByLabel("Destination").fill("Ibadan Customer");
    await captureForReview(page, "06-trips-create");
    await create.getByRole("button", { name: "Create trip" }).click();

    await expect(page.getByText("Trip created.").first()).toBeVisible();
    let write = await lastWrite(page);
    expect(write).toMatchObject({
      method: "POST",
      url: "/api/v1/trips",
      body: {
        vehicle_id: "4324a768-9b14-4223-a299-eb8da4d8d309",
        origin: "Refinery Gate",
        destination: "Ibadan Customer",
      },
    });
    expect(write?.body).not.toHaveProperty("status");

    const planned = row(page, "LSD-100-AA", "Planned");
    await expect(planned).toBeVisible();

    await planned.getByRole("button", { name: "Assign driver LSD-100-AA" }).click();
    const assign = page.getByRole("dialog").filter({ hasText: "Assign a driver" });
    await expect(assign).toBeVisible();
    await expectNoAxeViolations(page);
    await assign.getByLabel("Driver").click();
    await page.getByRole("option", { name: /Chinedu Musa/ }).first().click();
    await captureForReview(page, "06-trips-assign");
    await assign.getByRole("button", { name: "Assign driver" }).click();

    await expect(page.getByText("Trip assigned.").first()).toBeVisible();
    write = await lastWrite(page);
    expect(write).toMatchObject({ method: "PATCH", body: { status: "assigned" } });
    const assignedBody = write?.body as { driver_id?: string } | undefined;
    expect(assignedBody?.driver_id).toBeTruthy();

    const assigned = row(page, "LSD-100-AA", "Assigned");
    await expect(assigned).toBeVisible();
    await expect(assigned.getByRole("button", { name: "Start LSD-100-AA" })).toBeFocused();
    await assigned.getByRole("button", { name: "Start LSD-100-AA" }).click();
    await expect(page.getByText("Trip started.").first()).toBeVisible();
    write = await lastWrite(page);
    expect(write?.body).toEqual({ status: "active" });

    const active = row(page, "LSD-100-AA", "Active");
    await expect(active.getByRole("button", { name: "Complete LSD-100-AA" })).toBeFocused();
    await active.getByRole("button", { name: "Complete LSD-100-AA" }).click();
    const confirm = page.getByRole("dialog").filter({ hasText: "Complete trip" });
    await expect(confirm).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "06-trips-complete-confirm");
    await confirm.getByRole("button", { name: "Complete trip" }).click();

    await expect(page.getByText("Trip completed.").first()).toBeVisible();
    write = await lastWrite(page);
    expect(write?.body).toEqual({ status: "completed" });
    expect(write?.body).not.toHaveProperty("distance_km");

    const completed = row(page, "LSD-100-AA", "Completed").first();
    await expect(completed).toContainText("12.4 km");
    await expect(
      completed.getByRole("button", { name: /Open trip to .* for LSD-100-AA/ }),
    ).toBeFocused();
  });

  test("round-trips the status, search and order through the URL", async ({ page }) => {
    await gotoTrips(page);

    await page.getByLabel("Status").selectOption("active");
    await expect(page).toHaveURL(/status=active/);
    await expect(page.getByTestId("trips-page")).toContainText("4 loaded");

    await page.getByLabel("Status").selectOption("");
    await page.getByLabel("Search trips").fill("lsd101aa");
    await expect(page).toHaveURL(/q=lsd101aa/);
    await expect(row(page, "LSD-101-AA")).toHaveCount(1);

    await page.getByLabel("Sort").selectOption("started");
    await expect(page).toHaveURL(/order=started/);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Trips" })).toBeVisible();
    await expect(page.getByLabel("Search trips")).toHaveValue("lsd101aa");
    await expect(page.getByLabel("Sort")).toHaveValue("started");

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page).not.toHaveURL(/status=|q=/);
    await expect(page.getByTestId("trips-page")).toContainText("5 loaded");
  });

  test("shows the no-results empty state and clears it", async ({ page }) => {
    await gotoTrips(page);
    await page.getByLabel("Search trips").fill("NO-SUCH-TRIP");
    await expect(page.getByText("No trips match")).toBeVisible();
    await expect(page.getByText("Try a different search or clear the filters.")).toBeVisible();
    await captureForReview(page, "06-trips-empty");
    await expectNoAxeViolations(page);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByTestId("trips-page")).toContainText("5 loaded");
  });

  test("shows the no-data empty state", async ({ page }) => {
    await gotoTrips(page, "empty=trips");
    await expect(page.getByText("No trips yet")).toBeVisible();
    await expect(page.getByText("Create the first one.")).toBeVisible();
    await expect(page.getByText("No trips match")).toHaveCount(0);
    await captureForReview(page, "06-trips-no-data");
    await expectNoAxeViolations(page);
  });

  test("cancels an active trip after a confirm", async ({ page }) => {
    await gotoTrips(page);
    const active = row(page, "LSD-101-AA", "Active");
    await active.getByRole("button", { name: "Cancel trip for LSD-101-AA" }).click();

    const confirm = page.getByRole("dialog").filter({ hasText: "Cancel trip" });
    await expect(confirm).toBeVisible();
    await expectNoAxeViolations(page);
    await confirm.getByRole("button", { name: "Cancel trip" }).click();

    await expect(page.getByText("Trip cancelled.").first()).toBeVisible();
    const write = await lastWrite(page);
    expect(write).toMatchObject({ method: "PATCH", body: { status: "cancelled" } });
    expect(write?.body).not.toHaveProperty("distance_km");
    await expect(row(page, "LSD-101-AA", "Cancelled")).toBeVisible();
  });

  test("shows no results for a server status filter with no trips", async ({ page }) => {
    await gotoTrips(page, "status=planned");
    await expect(page.getByText("No trips match")).toBeVisible();
    await expect(page.getByText("No trips yet")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
  });

  test("loads the next page only when the first page is full", async ({ page }) => {
    test.setTimeout(40_000);
    await gotoTrips(page);
    await page.evaluate(async () => {
      await fetch("/api/v1/__mock/trips/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 105 }),
      });
    });

    await expect(page.getByTestId("trips-page")).toContainText("100 loaded", {
      timeout: 25_000,
    });
    const loadMore = page.getByRole("button", { name: "Load more" });
    await expect(loadMore).toBeVisible();
    await loadMore.click();
    await expect(page.getByTestId("trips-page")).toContainText("110 loaded");
    await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
  });

  test("opens a trip from a row and returns focus on close", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1440) < 1024, "desktop-only layout");
    await gotoTrips(page);

    const origin = page.getByRole("button", {
      name: /Open trip to Ibadan Customer for LSD-100-AA/,
    }).first();
    await origin.click();
    const drawer = page.getByRole("complementary", { name: "Trip details" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Refinery Gate")).toBeVisible();
    await expect(drawer.getByText("The API records only the start and end times.")).toBeVisible();
    await captureForReview(page, "06-trips-detail");

    await drawer.getByRole("button", { name: "View on map" }).click();
    await expect(page).toHaveURL(new RegExp(`/map\\?v=${COMPLETED_VEHICLE}`));
    await page.goBack();
    await expect(page.getByRole("complementary", { name: "Trip details" })).toBeVisible();
    await page.getByRole("button", { name: "Close trip details" }).click();
    await expect(page.getByRole("complementary", { name: "Trip details" })).toHaveCount(0);
    await expect(origin).toBeFocused();
  });

  test("keeps focus in the detail drawer after a transition", async ({ page }) => {
    await gotoTrips(page);
    await page
      .getByRole("button", { name: /Open trip to Ibadan Customer for LSD-101-AA/ })
      .click();
    const drawer = page.getByRole("complementary", { name: "Trip details" });
    await expect(drawer).toBeVisible();

    await drawer.getByRole("button", { name: "Complete" }).click();
    const confirm = page.getByRole("dialog").filter({ hasText: "Complete trip" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Complete trip" }).click();

    await expect(page.getByText("Trip completed.").first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(document.activeElement?.closest('aside[aria-label="Trip details"]')),
        ),
      )
      .toBe(true);
    await expect(drawer).toBeVisible();
  });

  test("opens a deep-linked trip and explains an unknown one", async ({ page }) => {
    await gotoTrips(page, `trip=${COMPLETED_TRIP}`);
    const drawer = page.getByRole("complementary", { name: "Trip details" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "LSD-100-AA" })).toBeVisible();
    await expect(drawer.getByText("10917 km")).toBeVisible();
    await expectNoAxeViolations(page);

    await gotoTrips(page, "trip=does-not-exist");
    await expect(page.getByText("Trip not found")).toBeVisible({ timeout: 15_000 });
    await captureForReview(page, "06-trips-not-found");
    await page.getByRole("button", { name: "Back to trips" }).click();
    await expect(page).not.toHaveURL(/trip=/);
  });

  test("viewers can read but cannot create or change trips", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fleet.mockRole", "viewer");
    });
    await gotoTrips(page);

    const create = page.getByRole("button", { name: "Create trip" });
    await expect(create).toHaveAttribute("aria-disabled", "true");
    await create.click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const action = page.getByRole("button", { name: /Complete|Start|Assign driver/ }).first();
    await expect(action).toHaveAttribute("aria-disabled", "true");
    await action.click({ force: true });
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(0);
  });

  test("security can read trips but cannot change them", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fleet.mockRole", "security");
    });
    await gotoTrips(page);
    await expect(page.getByTestId("trips-page")).toContainText("5 loaded");
    await expect(page.getByRole("button", { name: "Create trip" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

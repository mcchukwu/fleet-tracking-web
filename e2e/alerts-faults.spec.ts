import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations, expectNoHorizontalScroll } from "./helpers";

const ROUTE_DEVIATION = "ac1a223c-f9b0-46f3-9ead-13a10bfd6389";

async function gotoFault(page: Page, fault: string, extra = ""): Promise<void> {
  await page.goto(
    `/alerts?map=fake&fault=${encodeURIComponent(fault)}${extra ? `&${extra}` : ""}`,
  );
  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
}

async function clearFault(page: Page): Promise<void> {
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("fault");
    history.replaceState({}, "", `${url.pathname}${url.search}`);
  });
}

test.describe("alerts faults", () => {
  test("a server error with nothing cached shows the region error and Retry recovers", async ({
    page,
  }) => {
    await gotoFault(page, "alerts:server");
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("button", { name: "Retry", exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Something broke.")).toHaveCount(0);
    await captureForReview(page, "04-alerts-error");
    await expectNoAxeViolations(page);

    await clearFault(page);
    await page.getByRole("button", { name: "Retry", exact: true }).first().click();
    await expect(page.getByLabel("Copy plate LSD-102-AA").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("a refresh error keeps the cached rows and labels them", async ({
    page,
    liveSocket,
  }) => {
    await page.goto("/alerts?map=fake");
    await expect(page.getByLabel("Copy plate LSD-102-AA").first()).toBeVisible();
    await liveSocket.wait();

    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "alerts:server");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await liveSocket.send({
      type: "alert",
      tenant_id: "tenant-demo",
      vehicle_id: "demo-imei-0001",
      severity: "high",
      occurred_at: new Date().toISOString(),
    });

    await expect(page.getByText("Couldn't refresh")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Copy plate LSD-102-AA").first()).toBeVisible();
    await captureForReview(page, "04-alerts-stale-error");
  });

  test("offline keeps cached rows, marks them stale and disables acknowledge", async ({
    page,
    context,
  }) => {
    await page.goto("/alerts?map=fake");
    await expect(page.getByLabel("Copy plate LSD-102-AA").first()).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByText("You're offline", { exact: false }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Acknowledge alert for/ }).first(),
    ).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText(/Stale ·/)).toBeVisible();
    await captureForReview(page, "04-alerts-offline");
    await expectNoAxeViolations(page);
    await context.setOffline(false);
  });

  test("a slow list shows the working state and Cancel stops waiting", async ({ page }) => {
    test.setTimeout(30_000);
    await gotoFault(page, "alerts:slow");
    await expect(page.getByText("Still working…")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("Taking longer than usual")).toBeVisible({
      timeout: 12_000,
    });
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Still working…")).toHaveCount(0);
    await expect(page.getByText("Taking longer than usual")).toHaveCount(0);
  });

  test("a forbidden list shows the forbidden state", async ({ page }) => {
    await gotoFault(page, "alerts:forbidden");
    await expect(page.getByText("You don't have access to this.")).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("a malformed body degrades to a contract error with diagnostics", async ({ page }) => {
    await gotoFault(page, "alerts:malformed");
    await expect(page.getByText("Unexpected response from the server").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Copy diagnostics" })).toBeVisible();
    await expect(page.getByText(/Unexpected token|JSON/)).toHaveCount(0);
  });

  test("an unknown alert enum renders the neutral fallback", async ({ page }) => {
    await gotoFault(page, "alerts:unknown_enum");
    await expect(page.getByRole("cell", { name: "Unknown type: solar_flare" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Plate" })).toBeVisible();
  });

  test("an unknown alert deep link shows the not-found state with a way back", async ({
    page,
  }) => {
    await page.goto("/alerts?map=fake&alert=does-not-exist");
    await expect(page.getByText("Alert not found")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Back to alerts" })).toBeVisible();
    await captureForReview(page, "04-alerts-not-found");
    await expectNoAxeViolations(page);

    await page.getByRole("button", { name: "Back to alerts" }).click();
    await expect(page).not.toHaveURL(/alert=/);
  });

  test("a lost acknowledge reports that it was not saved and creates no duplicate", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/alerts?map=fake");
    await expect(page.getByLabel("Copy plate LSD-102-AA").first()).toBeVisible();
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "alerts-post:lost");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });

    await page
      .getByRole("row")
      .filter({ hasText: "LSD-102-AA" })
      .filter({ hasText: "Geofence exit" })
      .getByRole("button", { name: /Acknowledge alert for/ })
      .click();

    await expect(page.getByText("It wasn't saved.")).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole("alert").filter({ hasText: "It wasn't saved." })).toBeVisible();
    const writes = await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? []);
    expect(writes).toHaveLength(0);
  });

  test("a rules query failure shows a region error and Retry", async ({ page }) => {
    await gotoFault(page, "alert-rules:server", "tab=rules");
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    await captureForReview(page, "04-alerts-rules-error");
    await expectNoAxeViolations(page);
  });

  test("a lost rule write reports that it was not saved", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/alerts?map=fake&tab=rules");
    const speeding = page.getByRole("listitem").filter({ hasText: "Speeding" });
    await expect(speeding).toBeVisible();

    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "alert-rules-patch:lost");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });

    await speeding.getByRole("checkbox", { name: "Enabled Speeding rule" }).click();
    await expect(page.getByText("It wasn't saved. Try again.")).toBeVisible({
      timeout: 40_000,
    });
    const writes = await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? []);
    expect(writes).toHaveLength(0);
  });

  test("a detail lookup failure shows the error inside the drawer", async ({ page }) => {
    await page.goto(
      `/alerts?map=fake&fault=${encodeURIComponent("alerts:server")}&alert=does-not-exist`,
    );
    const drawer = page.getByRole("complementary", { name: "Alert details" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Something went wrong on our side")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      drawer.getByRole("button", { name: "Retry", exact: true }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("a history failure keeps the detail readable and offers Retry", async ({ page }) => {
    await page.goto(
      `/alerts?map=fake&fault=${encodeURIComponent("vehicle-history:server")}&alert=${ROUTE_DEVIATION}`,
    );
    const drawer = page.getByRole("complementary", { name: "Alert details" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Position unavailable")).toBeVisible({ timeout: 15_000 });
    await expect(drawer.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    await captureForReview(page, "04-alerts-position-error");
    await expectNoAxeViolations(page);
  });

  test("a trip lookup failure stays inside the trip section", async ({ page }) => {
    await page.goto(
      `/alerts?map=fake&fault=${encodeURIComponent("trips:server")}&alert=${ROUTE_DEVIATION}`,
    );
    const drawer = page.getByRole("complementary", { name: "Alert details" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Route deviation" })).toBeVisible();
    await expect(
      drawer.getByText("Something went wrong on our side").first(),
    ).toBeVisible({ timeout: 15_000 });
    await captureForReview(page, "04-alerts-trip-error");
    await expectNoAxeViolations(page);
  });

  test("the pending acknowledge state passes axe", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/alerts?map=fake");
    await expect(page.getByLabel("Copy plate LSD-102-AA").first()).toBeVisible();

    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "alerts-post:slow");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });

    const ack = page
      .getByRole("row")
      .filter({ hasText: "LSD-102-AA" })
      .filter({ hasText: "Geofence exit" })
      .getByRole("button", { name: /Acknowledge alert for/ });
    await ack.click();
    await expect(ack).toHaveAttribute("aria-busy", "true");
    await expectNoAxeViolations(page);
  });

  test("a render crash is contained by the route boundary", async ({ page }) => {
    await page.goto("/alerts?map=fake&crash=alerts");
    await expect(page.getByText("This part of the page stopped working")).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await captureForReview(page, "04-alerts-crash");
  });
});

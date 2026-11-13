import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectTouchTargets,
} from "./helpers";

const GEOFENCE_EXIT = "fbad9142-c164-463d-ae76-3262f2d3b4f9";
const ROUTE_DEVIATION = "ac1a223c-f9b0-46f3-9ead-13a10bfd6389";

function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 1024;
}

async function setRole(page: Page, role: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockRole", value);
  }, role);
}

async function gotoAlerts(page: Page, search = ""): Promise<void> {
  await page.goto(`/alerts?map=fake${search ? `&${search}` : ""}`);
  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
}

function row(page: Page, plate: string, type?: string) {
  const base = page.getByRole("row").filter({ hasText: plate });
  return type ? base.filter({ hasText: type }) : base;
}

test.describe("alerts", () => {
  test("loads the list with counts, title, tabs and unknown fallbacks", async ({ page }) => {
    await gotoAlerts(page);

    await expect(page.getByRole("tab", { name: "Alerts" })).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("columnheader", { name: "Plate" })).toBeVisible();
    await expect(page.getByTestId("alerts-page")).toContainText("7 open");
    await expect(page.getByTestId("alerts-page")).toContainText("10 loaded");
    await expect.poll(() => page.title()).toBe("(7) Alerts · Fleet Console");

    await expect(page.getByRole("cell", { name: "Speeding" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Route deviation" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Unknown type: solar_flare" })).toBeVisible();
    await expect(page.getByRole("cell", { name: /Unknown severity: extreme/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Unknown status: pending" })).toBeVisible();
    if (!isMobile(page)) {
      await expect(page.getByRole("cell", { name: "Ibadan Customer" })).toBeVisible();
    }

    await captureForReview(page, "04-alerts-list");
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test("combines server and client filters and restores them from the URL", async ({ page }) => {
    await gotoAlerts(page);

    await page.getByLabel("Status").selectOption("acked");
    await expect(page).toHaveURL(/status=acked/);
    await expect(row(page, "LSD-100-AA")).toHaveCount(1);
    await expect(page.getByTestId("alerts-page")).toContainText("1 loaded");

    await page.getByLabel("Status").selectOption("");
    await page.getByLabel("Severity").selectOption("critical");
    await expect(page).toHaveURL(/severity=critical/);
    await expect(row(page, "LSD-102-AA", "Speeding")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Geofence exit" })).toHaveCount(0);

    await page.getByLabel("Severity").selectOption("");
    await page.getByLabel("Search plate").fill("lsd101aa");
    await expect(page).toHaveURL(/q=lsd101aa/);
    await expect(row(page, "LSD-101-AA").first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "Speeding" })).toHaveCount(0);

    await page.getByLabel("Status").selectOption("open");
    await page.getByLabel("Type").selectOption("route_deviation");
    await expect(page).toHaveURL(/status=open/);
    await expect(page).toHaveURL(/type=route_deviation/);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
    await expect(page.getByLabel("Status")).toHaveValue("open");
    await expect(page.getByLabel("Type")).toHaveValue("route_deviation");

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByTestId("alerts-page")).toContainText("10 loaded");
    await expect(page).not.toHaveURL(/status=|type=|severity=|q=/);
  });

  test("shows the no-results empty state and clears the filters", async ({ page }) => {
    await gotoAlerts(page);
    await page.getByLabel("Search plate").fill("NO-SUCH-PLATE");
    await expect(page.getByText("No alerts match")).toBeVisible();
    await expect(page.getByText("Try a different search or clear the filters.")).toBeVisible();
    await captureForReview(page, "04-alerts-empty");
    await expectNoAxeViolations(page);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByTestId("alerts-page")).toContainText("10 loaded");
  });

  test("loads more when the first 500-row page is full", async ({ page, liveSocket }) => {
    await gotoAlerts(page);
    await page.evaluate(async () => {
      await fetch("/api/v1/__mock/alerts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 500 }),
      });
    });
    await liveSocket.wait();
    await liveSocket.send({
      type: "alert",
      tenant_id: "tenant-demo",
      vehicle_id: "demo-imei-0001",
      severity: "high",
      occurred_at: new Date().toISOString(),
    });

    await expect(page.getByTestId("alerts-page")).toContainText("500 loaded", {
      timeout: 10_000,
    });
    const renderedRows = await page.getByRole("row").count();
    expect(renderedRows).toBeLessThan(100);
    await page.getByRole("button", { name: "Load more" }).click();
    await expect(page.getByTestId("alerts-page")).toContainText("510 loaded");
  });

  test("a live alert waits in a pill while the list is scrolled", async ({ page, liveSocket }) => {
    await gotoAlerts(page);
    await liveSocket.wait();
    await page.evaluate(async () => {
      await fetch("/api/v1/__mock/alerts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 60 }),
      });
    });
    await page.getByLabel("Status").selectOption("open");
    await expect(page.getByTestId("alerts-page")).toContainText("55 loaded");

    const scroller = page.locator("[data-data-table-scroll]");
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

    await page.evaluate(async () => {
      await fetch("/api/v1/__mock/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: "demo-imei-0001" }),
      });
    });
    await liveSocket.send({
      type: "alert",
      tenant_id: "tenant-demo",
      vehicle_id: "demo-imei-0001",
      severity: "high",
      occurred_at: new Date().toISOString(),
    });

    const pill = page.getByRole("button", { name: "1 new alert" });
    await expect(pill).toBeVisible({ timeout: 10_000 });
    await captureForReview(page, "04-alerts-new-pill");

    await pill.click();
    await expect(page.getByTestId("alerts-page")).toContainText("56 loaded");
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(0);
  });

  test("opens the detail with position, zone, evidence and focus return", async ({ page }) => {
    await gotoAlerts(page, `alert=${GEOFENCE_EXIT}`);
    const drawer = page.getByRole("complementary", { name: "Alert details" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Geofence exit" })).toBeVisible();
    await expect(drawer.getByText("Ibadan Customer")).toBeVisible();
    await expect(drawer.getByText(/Nearest position at/)).toBeVisible();
    await expect(drawer.getByText("No trip linked.")).toBeVisible();
    await expect(drawer.getByText("Geofence id")).toBeVisible();
    const position = drawer.getByRole("region", { name: "Alert position" });
    await expect(position).toBeVisible();
    await expect(position).not.toHaveAttribute("aria-busy", "true");

    await drawer.getByRole("button", { name: "Raw JSON" }).click();
    await expect(drawer.getByText(/"geofence_id"/)).toBeVisible();
    await captureForReview(page, "04-alerts-detail");
    await expectNoAxeViolations(page);

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    const origin = page.locator(`[data-alert-id="${GEOFENCE_EXIT}"]`);
    await expect(origin).toBeFocused();

    await expectNoAxeViolations(page);
  });

  test("replay carries the alert range and the vehicle", async ({ page }) => {
    await gotoAlerts(page, `alert=${ROUTE_DEVIATION}`);
    const drawer = page.getByRole("complementary", { name: "Alert details" });
    await expect(drawer.getByText("Refinery Gate → Ibadan Customer")).toBeVisible();

    await drawer.getByRole("button", { name: "Replay last 30 minutes" }).click();
    await expect(page).toHaveURL(/\/playback\?/);
    await expect(page).toHaveURL(/vehicle=6c69032e-b802-447e-8f7a-ad8c0ddc2359/);
    await expect(page).toHaveURL(/from=2026-11-02T19%3A37%3A39.179Z/);
    await expect(page).toHaveURL(/to=2026-11-02T20%3A09%3A39.179Z/);
    await expect(page.getByRole("heading", { name: "Playback" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Playback controls" })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.playback?.pointCount ?? 0), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
  });

  test("acknowledges from a row and removes it from the open filter", async ({ page }) => {
    await gotoAlerts(page, "status=open");
    const target = row(page, "LSD-102-AA", "Geofence exit");
    await target.getByRole("button", { name: /Acknowledge alert for LSD-102-AA/ }).click();

    await expect(page.getByText("Acknowledged.").first()).toBeVisible();
    await expect(target).toHaveCount(0);
    const writes = await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? []);
    expect(writes.at(-1)).toMatchObject({
      method: "POST",
      url: `/api/v1/alerts/${GEOFENCE_EXIT}/ack`,
    });

    await page.getByLabel("Status").selectOption("acked");
    const acked = row(page, "LSD-102-AA", "Geofence exit");
    await expect(acked.getByText("Acknowledged")).toBeVisible();
    await captureForReview(page, "04-alerts-acked");
  });

  test("a viewer cannot acknowledge", async ({ page }) => {
    await setRole(page, "viewer");
    await gotoAlerts(page);
    const ack = row(page, "LSD-102-AA", "Geofence exit").getByRole("button", {
      name: /Acknowledge alert for LSD-102-AA/,
    });
    await expect(ack).toHaveAttribute("aria-disabled", "true");
    await ack.click({ force: true });
    const writes = await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? []);
    expect(writes).toHaveLength(0);
  });

  test("security can acknowledge", async ({ page }) => {
    await setRole(page, "security");
    await gotoAlerts(page);
    await row(page, "LSD-102-AA", "Geofence exit")
      .getByRole("button", { name: /Acknowledge alert for LSD-102-AA/ })
      .click();
    await expect(page.getByText("Acknowledged.").first()).toBeVisible();
  });

  test("acknowledging an alert already acked elsewhere explains it", async ({ page }) => {
    await gotoAlerts(page);
    await page.evaluate(async (id) => {
      await fetch(`/api/v1/alerts/${id}/ack`, { method: "POST" });
    }, GEOFENCE_EXIT);

    await row(page, "LSD-102-AA", "Geofence exit")
      .getByRole("button", { name: /Acknowledge alert for LSD-102-AA/ })
      .click();
    await expect(
      page.getByText("This alert was acknowledged elsewhere.", { exact: true }),
    ).toBeVisible({
      timeout: 15_000,
    });
  });

  test("rules list, toggle, config save and invalid input", async ({ page }) => {
    await gotoAlerts(page, "tab=rules");
    await expect(page.getByRole("tab", { name: "Alert rules" })).toHaveAttribute(
      "data-state",
      "active",
    );
    const speeding = page.getByRole("listitem").filter({ hasText: "Speeding" });
    await expect(speeding).toBeVisible();
    await expect(page.getByText("Unknown type: solar_flare")).toBeVisible();
    await expect(page.getByText("This rule type has no settings editor.")).toBeVisible();
    await captureForReview(page, "04-alerts-rules");
    await expectNoAxeViolations(page);

    await speeding.getByRole("checkbox", { name: "Enabled Speeding rule" }).click();
    await expect(page.getByText("Alert rule updated.").first()).toBeVisible();
    let writes = await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? []);
    expect(writes.at(-1)?.body).toEqual({ enabled: false });

    await speeding.getByRole("button", { name: "Edit settings for Speeding" }).click();
    await speeding.getByLabel("Speed kph").fill("81");
    await speeding.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Alert rule updated.").first()).toBeVisible();
    writes = await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? []);
    expect(writes.at(-1)?.body).toEqual({
      config: { speed_kph: 81, duration_s: 120 },
    });
    await captureForReview(page, "04-alerts-rule-config");

    await speeding.getByLabel("Speed kph").fill("-1");
    await speeding.getByRole("button", { name: "Save settings" }).click();
    await expect(speeding.getByText("Enter a number of 0 or more.")).toBeVisible();
    const count = writes.length;
    writes = await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? []);
    expect(writes).toHaveLength(count);
  });

  test("viewers cannot change rules", async ({ page }) => {
    await setRole(page, "viewer");
    await gotoAlerts(page, "tab=rules");
    await expect(page.getByText("Your role can't change alert rules.").first()).toBeVisible();
    const enabled = page
      .getByRole("listitem")
      .filter({ hasText: "Speeding" })
      .getByRole("checkbox", { name: "Enabled Speeding rule" });
    await expect(enabled).toBeDisabled();
  });

  test(
    "the detail panel starts below the top bar on desktop",
    { tag: "@theme" },
    async ({ page }) => {
      test.skip(isMobile(page), "desktop-only layout");
      await gotoAlerts(page, `alert=${GEOFENCE_EXIT}`);
      const drawer = page.getByRole("complementary", { name: "Alert details" });
      await expect(drawer).toBeVisible();
      const box = await drawer.boundingBox();
      if (!box) throw new Error("missing drawer box");
      expect(box.y).toBeGreaterThanOrEqual(59);
      expect(box.y).toBeLessThanOrEqual(61);
    },
  );

  test(
    "the detail is a top-quarter sheet on mobile and leaves the title visible",
    { tag: "@theme" },
    async ({ page }) => {
      test.skip(!isMobile(page), "mobile-only layout");
      await gotoAlerts(page, `alert=${GEOFENCE_EXIT}`);
      const drawer = page.getByRole("complementary", { name: "Alert details" });
      await expect(drawer).toBeVisible();

      const box = await drawer.boundingBox();
      const tabs = await page.getByRole("tablist").boundingBox();
      if (!box || !tabs) throw new Error("missing layout boxes");
      expect(box.y).toBeGreaterThanOrEqual(844 * 0.24);
      expect(box.y).toBeGreaterThan(tabs.y + tabs.height);
      await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();

      await expectNoHorizontalScroll(page);
      await expectTouchTargets(page, 44);
      await expectNoAxeViolations(page);
      await captureForReview(page, "04-alerts-detail-mobile");
    },
  );
});

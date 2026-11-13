import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { expectNoHorizontalScroll } from "./helpers";

const DAY = 86_400_000;
const FROM = "2026-11-01T00:00:00Z";
const TO = "2026-11-08T00:00:00Z";

function rangeUrl(from = FROM, to = TO): string {
  return `/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

async function setScenario(page: Page, scenario: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockReports", value);
  }, scenario);
}

async function setRole(page: Page, role: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockRole", value);
  }, role);
}

async function gotoReports(page: Page, search = "/reports"): Promise<void> {
  await page.goto(search);
  await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
}

function searchParam(page: Page, name: string): string | null {
  return new URL(page.url()).searchParams.get(name);
}

async function rangeDuration(page: Page): Promise<number> {
  const from = searchParam(page, "from");
  const to = searchParam(page, "to");
  return Date.parse(to ?? "") - Date.parse(from ?? "");
}

function isSummaryRequest(url: string): boolean {
  return new URL(url).pathname.endsWith("/reports/summary");
}

async function nextSummaryRequest(page: Page): Promise<URL> {
  const request = await page.waitForRequest((candidate) => isSummaryRequest(candidate.url()));
  return new URL(request.url());
}

function requestedDuration(url: URL): number {
  return (
    Date.parse(url.searchParams.get("to") ?? "") - Date.parse(url.searchParams.get("from") ?? "")
  );
}

test.describe("reports", () => {
  test("writes a seven-day default, requests it and renders every stat", async ({ page }) => {
    const summary = nextSummaryRequest(page);
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    await expect.poll(() => searchParam(page, "from")).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(await rangeDuration(page)).toBe(7 * DAY);
    await expect(page.getByRole("button", { name: "Range, 7 days" })).toBeVisible();

    const requested = await summary;
    expect(requested.searchParams.get("from")).toBe(searchParam(page, "from"));
    expect(requested.searchParams.get("to")).toBe(searchParam(page, "to"));
    expect(requested.searchParams.get("from")).toMatch(/Z$/);
    expect(requestedDuration(requested)).toBe(7 * DAY);

    const strip = page.getByTestId("reports-stats");
    await expect(strip.getByText("Vehicles")).toBeVisible();
    await expect(strip.getByText("25", { exact: true })).toBeVisible();
    await expect(strip.getByText("Fleet total")).toBeVisible();
    await expect(strip.getByText("Trips", { exact: true })).toBeVisible();
    await expect(strip.getByText("20% of trips")).toBeVisible();
    await expect(strip.getByText("66", { exact: true })).toBeVisible();
    await expect(strip.getByText("45", { exact: true })).toBeVisible();
    await expect(strip.getByText("10,917 km")).toBeVisible();

    await expect(page.getByRole("img", { name: /Alerts by type/ })).toBeVisible();
    await expect(page).toHaveTitle("Reports · Fleet Console");
  });

  test("clearing the range in place writes the default back", async ({ page }) => {
    await gotoReports(page, rangeUrl());
    await expect(page.getByTestId("reports-stats")).toBeVisible();

    if ((page.viewportSize()?.width ?? 1440) < 768) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    const summary = nextSummaryRequest(page);
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Reports" })
      .click();

    await expect.poll(() => searchParam(page, "from")).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(await rangeDuration(page)).toBe(7 * DAY);
    const requested = await summary;
    expect(requested.searchParams.get("from")).toBe(searchParam(page, "from"));
    await expect(page.getByTestId("reports-stats")).toBeVisible();
    await expect(page.getByLabel("Loading report")).toHaveCount(0);
  });

  test("each preset writes its duration to the URL", async ({ page }) => {
    await gotoReports(page, rangeUrl());

    await page.getByRole("button", { name: "Range, 7 days" }).click();
    const dayRequest = nextSummaryRequest(page);
    await page.getByRole("menuitemradio", { name: "24 hours" }).click();
    await expect(page.getByRole("button", { name: "Range, 24 hours" })).toBeVisible();
    await expect.poll(() => rangeDuration(page)).toBe(DAY);
    expect(requestedDuration(await dayRequest)).toBe(DAY);

    await page.getByRole("button", { name: "Range, 24 hours" }).click();
    const monthRequest = nextSummaryRequest(page);
    await page.getByRole("menuitemradio", { name: "30 days" }).click();
    await expect(page.getByRole("button", { name: "Range, 30 days" })).toBeVisible();
    await expect.poll(() => rangeDuration(page)).toBe(30 * DAY);
    expect(requestedDuration(await monthRequest)).toBe(30 * DAY);
  });

  test.describe("custom range", () => {
    test.use({ timezoneId: "Africa/Lagos" });

    test("converts local fields to UTC and restores the range on reload", async ({ page }) => {
      await gotoReports(page, rangeUrl());

      await page.getByRole("button", { name: "Range, 7 days" }).click();
      await page.getByRole("menuitem", { name: "Custom range…" }).click();
      const dialog = page.getByRole("dialog", { name: "Report range" });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Start").fill("2026-11-01T09:00");
      await dialog.getByLabel("End").fill("2026-11-02T10:00");
      const summary = nextSummaryRequest(page);
      await dialog.getByRole("button", { name: "Apply" }).click();

      await expect.poll(() => searchParam(page, "from")).toBe("2026-11-01T08:00:00.000Z");
      expect(searchParam(page, "to")).toBe("2026-11-02T09:00:00.000Z");
      const requested = await summary;
      expect(requested.searchParams.get("from")).toBe("2026-11-01T08:00:00.000Z");
      expect(requested.searchParams.get("to")).toBe("2026-11-02T09:00:00.000Z");
      await expect(page.getByRole("button", { name: "Range, Custom" })).toBeVisible();
      await expect(page.getByTestId("reports-stats")).toBeVisible();

      await page.reload();
      await expect.poll(() => searchParam(page, "from")).toBe("2026-11-01T08:00:00.000Z");
      await expect(page.getByTestId("reports-stats")).toBeVisible({ timeout: 15_000 });
    });
  });

  test("a valid offset deep link is honoured and invalid ones never render data", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoReports(
      page,
      `/reports?from=${encodeURIComponent("2026-11-01T00:00:00+01:00")}&to=${encodeURIComponent(
        "2026-11-08T00:00:00+01:00",
      )}`,
    );
    await expect(page.getByTestId("reports-stats")).toBeVisible();

    const invalid = [
      "from=2026-11-01&to=2026-11-08",
      "from=2026-11-08T00%3A00%3A00Z&to=2026-11-01T00%3A00%3A00Z",
      "from=2026-11-08T00%3A00%3A00Z&to=2026-11-08T00%3A00%3A00Z",
      "from=nonsense&to=2026-11-08T00%3A00%3A00Z",
    ];
    for (const search of invalid) {
      await page.goto(`/reports?${search}`);
      await expect(page.getByText("That range isn't valid")).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole("button", { name: "Use last 7 days" })).toBeVisible();
      await expect(page.getByTestId("reports-stats")).toHaveCount(0);
    }
  });

  test("stat links open the matching screens and filters", async ({ page }) => {
    await gotoReports(page, rangeUrl());
    await expect(page.getByTestId("reports-stats")).toBeVisible();

    await page.getByRole("link", { name: /^Open alerts/ }).click();
    await expect(page).toHaveURL(/\/alerts\?status=open/);

    await page.goBack();
    await expect(page.getByTestId("reports-stats")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: /^Completed trips/ }).click();
    await expect(page).toHaveURL(/\/trips\?status=completed/);

    await page.goBack();
    await expect(page.getByTestId("reports-stats")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: /^Vehicles/ }).click();
    await expect(page).toHaveURL(/\/map/);
  });

  test("the zero fixture renders zeros and the chart's empty state", async ({ page }) => {
    await setScenario(page, "zero");
    await gotoReports(page, rangeUrl());
    const strip = page.getByTestId("reports-stats");
    await expect(strip.getByText("0.0 km")).toBeVisible();
    await expect(strip.locator('[data-stat-id="completedTrips"]').getByText("—")).toBeVisible();
    await expect(page.getByText("No alerts in this range")).toBeVisible();
    await expect(page.getByText(/Can't reach the server/)).toHaveCount(0);
  });

  test("the large fixture formats counts, sorts bars and drops zero rows", async ({ page }) => {
    await setScenario(page, "large");
    await gotoReports(page, rangeUrl());

    const strip = page.getByTestId("reports-stats");
    await expect(strip.getByText("45,231")).toBeVisible();
    await expect(strip.getByText("1.3M km")).toBeVisible();

    const labels = page.getByTestId("chart-label");
    await expect(labels).toHaveText(["Speeding", "Geofence exit", "Unknown type: solar_flare"]);
    await expect(page.getByRole("img", { name: /Alerts by type/ })).toContainText("30,120");
    await expectNoHorizontalScroll(page);
  });

  test("the chart has an accessible description and a matching data table", async ({ page }) => {
    await gotoReports(page, rangeUrl());
    await expect(page.getByRole("img", { name: /Alerts by type/ })).toHaveAccessibleDescription(
      "Alerts by type: Geofence exit 31, Geofence entry 28, Route deviation 7.",
    );

    await page.getByText("View data table").click();
    const table = page.getByRole("table", { name: "Alerts by type" });
    await expect(table).toBeVisible();
    const rows = table.locator('tbody tr[data-row="data"]');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Geofence exit");
    await expect(rows.nth(1)).toContainText("Geofence entry");
    await expect(rows.nth(2)).toContainText("Route deviation");
  });

  test("a viewer can read the report", async ({ page }) => {
    await setRole(page, "viewer");
    await gotoReports(page, rangeUrl());
    await expect(page.getByTestId("reports-stats")).toBeVisible();
    await expect(page.getByTestId("reports-stats").getByText("Vehicles")).toBeVisible();
  });
});

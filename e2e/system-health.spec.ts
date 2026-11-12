import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { expectNoHorizontalScroll, primeOfflineSession } from "./helpers";

async function setScenario(page: Page, scenario: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockSystem", value);
  }, scenario);
}

async function setRole(page: Page, role: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockRole", value);
  }, role);
}

async function gotoSystem(page: Page, search = "/system"): Promise<void> {
  await page.goto(search);
  await expect(
    page.getByRole("heading", { name: "System health", level: 1 }),
  ).toBeVisible({ timeout: 15_000 });
}

function isHealthRequest(url: string): boolean {
  return new URL(url).pathname.endsWith("/system/health");
}

async function setVisibility(page: Page, value: "visible" | "hidden"): Promise<void> {
  await page.evaluate((next) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => next,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, value);
}

test.describe("system health", () => {
  test("shows the all-green fixture with every group and the document title", async ({
    page,
  }) => {
    await gotoSystem(page);

    await expect(page.getByText("All systems healthy")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.locator('[data-health-group="fleet"]').getByText("20 of 25"),
    ).toBeVisible();
    await expect(
      page.locator('[data-health-group="fleet"]').getByText("80% of vehicles"),
    ).toBeVisible();
    await expect(
      page.locator('[data-health-group="fleet"]').getByText("45", { exact: true }),
    ).toBeVisible();

    const ingest = page.locator('[data-health-group="ingest"]');
    for (const label of [
      "Received",
      "Dropped",
      "Stale messages",
      "Validation errors",
      "Queue depth",
      "Cold-path failures",
      "Cold-path queue",
      "Redis errors",
    ]) {
      await expect(ingest.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(ingest.getByText("72,180", { exact: true })).toBeVisible();
    await expect(ingest.getByText(/of 20,000/)).toBeVisible();
    await expect(page.getByText(/Health updated/)).toBeVisible();
    await expect(page).toHaveTitle("System health · Fleet Console");
    await expectNoHorizontalScroll(page);
  });

  test("a down dependency is critical, sorts first and counts as an issue", async ({
    page,
  }) => {
    await setScenario(page, "dependency-down");
    await gotoSystem(page);

    await expect(page.getByText("1 issue needs attention")).toBeVisible({
      timeout: 15_000,
    });
    const rows = page.locator(
      '[data-health-group="dependencies"] [data-health-item]',
    );
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute("data-health-id", "dependency-redis");
    await expect(rows.nth(0)).toHaveAttribute("data-health-tone", "critical");
    await expect(rows.nth(0)).toContainText("Down");
    await expect(rows.nth(1)).toHaveAttribute("data-health-tone", "healthy");
    await expect(rows.nth(1)).toContainText("Up");
  });

  test("a rising failure counter warns with a delta and a rate", async ({ page }) => {
    await setScenario(page, "rising");
    await gotoSystem(page);
    await expect(page.getByText("All systems healthy")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Refresh" }).click();

    const dropped = page.locator('[data-health-id="dropped"]');
    await expect(dropped).toHaveAttribute("data-health-tone", "warning", {
      timeout: 15_000,
    });
    await expect(dropped).toContainText(/\+3 · .*\/s/);
    await expect(page.locator('[data-health-id="validation-errors"]')).toHaveAttribute(
      "data-health-tone",
      "healthy",
    );
    const ingest = page.locator(
      '[data-health-group="ingest"] [data-health-item]',
    );
    await expect(ingest.nth(0)).toHaveAttribute("data-health-id", "dropped");
    await expect(page.getByText(/issues? need attention/)).toBeVisible();
  });

  test("a queue at capacity is critical", async ({ page }) => {
    await setScenario(page, "queue-full");
    await gotoSystem(page);

    const queue = page.locator('[data-health-id="queue"]');
    await expect(queue).toHaveAttribute("data-health-tone", "critical", {
      timeout: 15_000,
    });
    await expect(queue).toContainText("20,000");
    await expect(queue).toContainText("of 20,000");
  });

  test("polls every 10s while visible and pauses while hidden", async ({ page }) => {
    test.setTimeout(60_000);
    await page.clock.install();
    let requests = 0;
    page.on("request", (request) => {
      if (isHealthRequest(request.url())) requests += 1;
    });

    await gotoSystem(page);
    await expect(page.getByText("All systems healthy")).toBeVisible({
      timeout: 15_000,
    });
    await expect.poll(() => requests).toBeGreaterThanOrEqual(1);
    const afterLoad = requests;

    await page.clock.runFor(10_000);
    await expect.poll(() => requests).toBe(afterLoad + 1);

    await setVisibility(page, "hidden");
    await page.clock.runFor(30_000);
    expect(requests).toBe(afterLoad + 1);

    await setVisibility(page, "visible");
    await expect.poll(() => requests).toBe(afterLoad + 2);
  });

  test("offline keeps cached values with a stale label and no error", async ({
    page,
    context,
  }) => {
    await gotoSystem(page);
    await expect(page.getByText("All systems healthy")).toBeVisible({
      timeout: 15_000,
    });

    await context.setOffline(true);
    await expect(page.getByText("You're offline").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Stale ·/)).toBeVisible();
    await expect(page.getByText("20 of 25")).toBeVisible();
    await expect(page.getByText(/Can't reach the API/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Refresh" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await context.setOffline(false);
    await expect(page.getByText("You're offline")).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test("offline without a cache shows the neutral offline state", async ({ page }) => {
    await primeOfflineSession(page);
    await gotoSystem(page);

    await expect(
      page.getByText("System health isn't available offline"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
    await expect(page.getByText("All systems healthy")).toHaveCount(0);
  });

  test("a viewer can read the same screen", async ({ page }) => {
    await setRole(page, "viewer");
    await gotoSystem(page);
    await expect(page.getByText("All systems healthy")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Received")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Refresh" }),
    ).toBeVisible();
  });

  test("a failed first load recovers with Retry", async ({ page }) => {
    await gotoSystem(page, `/system?fault=${encodeURIComponent("system-health:server")}`);
    await expect(page.getByText("Can't reach the API")).toBeVisible({
      timeout: 15_000,
    });

    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("fault");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await page.getByRole("button", { name: "Retry" }).first().click();
    await expect(page.getByText("All systems healthy")).toBeVisible({
      timeout: 15_000,
    });
  });
});

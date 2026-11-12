import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  captureForReview,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./helpers";

async function setRole(page: Page, role: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockRole", value);
  }, role);
}

async function setScenario(page: Page, scenario: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("fleet.mockAudit", value);
  }, scenario);
}

async function gotoAudit(page: Page, search = ""): Promise<void> {
  await page.goto(`/audit${search ? `?${search}` : ""}`);
  await expect(
    page.getByRole("heading", { name: "Audit", level: 1 }),
  ).toBeVisible({ timeout: 15_000 });
}

async function asRole(page: Page, role: string, search = ""): Promise<void> {
  await setRole(page, role);
  await gotoAudit(page, search);
}

function row(page: Page, text: string) {
  return page.getByRole("row").filter({ hasText: text });
}

async function appendEntry(page: Page): Promise<void> {
  const response = await page.evaluate(async () => {
    const result = await fetch("/api/v1/__mock/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "user.role_change",
        entity: "maintenance_job",
        entity_id: "00000000-0000-0000-0000-000000000901",
        user_name: "Demo Admin",
        metadata: { from: "viewer", to: "admin" },
      }),
    });
    return result.status;
  });
  expect(response).toBe(200);
}

test.describe("audit", () => {
  test("admin and security reach the log; dispatcher and viewer are blocked", async ({
    page,
  }) => {
    await asRole(page, "admin");
    await expect(page.getByTestId("audit-page")).toContainText("12 entries loaded");

    await asRole(page, "security");
    await expect(
      page.getByRole("row").filter({ hasText: "Demo Admin" }).first(),
    ).toBeVisible();

    await setRole(page, "dispatcher");
    await page.goto("/audit");
    await expect(page).toHaveURL(/\/forbidden$/);
    await expect(page.getByText("You don't have access to this.")).toBeVisible();

    await setRole(page, "viewer");
    await page.goto("/audit");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("shows the six-column log, no invented total and the document title", async ({
    page,
  }) => {
    await asRole(page, "admin");

    const headers = page.getByRole("columnheader");
    await expect(headers).toHaveCount(6);
    for (const [index, label] of [
      "Time",
      "Actor",
      "Action",
      "Entity",
      "Entity ID",
      "Details",
    ].entries()) {
      await expect(headers.nth(index)).toHaveText(label);
    }
    await expect(page.getByTestId("audit-page")).toContainText("12 entries loaded");
    await expect(page.getByTestId("audit-page")).not.toContainText(/total/i);
    await expect(page).toHaveTitle("Audit · Fleet Console");
    await expect(row(page, "Import vehicles")).toHaveCount(1);
    await expect(row(page, "Import vehicles")).toContainText("12 imported · 2 failed");
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-list");
  });

  test("filters by text without a request and round-trips the URL", async ({ page }) => {
    await asRole(page, "admin");

    const requests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.endsWith("/audit")) {
        requests.push(request.url());
      }
    });

    await page.getByLabel("Search audit log").fill("import");
    await expect(page).toHaveURL(/q=import/);
    await expect(page.getByTestId("audit-page")).toContainText("1 of 12 loaded");
    await expect(row(page, "Import vehicles")).toHaveCount(1);
    expect(requests).toEqual([]);

    await page.getByLabel("Search audit log").fill("zzzz-nothing");
    await expect(page.getByText("No entries match")).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-no-results");

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(page.getByTestId("audit-page")).toContainText("12 entries loaded");
  });

  test("filters by action and restores the filter on reload", async ({ page }) => {
    await asRole(page, "admin");

    await page.getByLabel("Action").selectOption("auth.login");
    await expect(page).toHaveURL(/action=auth\.login/);
    await expect(page.getByTestId("audit-page")).toContainText("1 of 12 loaded");
    await expect(row(page, "Login")).toHaveCount(1);

    await page.reload();
    await expect(page.getByLabel("Action")).toHaveValue("auth.login");
    await expect(page.getByTestId("audit-page")).toContainText("1 of 12 loaded");
  });

  test("opens a row in the drawer, closes with Escape and returns focus", async ({
    page,
  }) => {
    await asRole(page, "admin");

    const open = page.getByRole("button", {
      name: /Open audit entry: Import vehicles/i,
    });
    await open.click();

    const drawer = page.getByRole("complementary", { name: "Audit entry details" });
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "Close audit entry" }),
    ).toBeFocused();
    await expect(drawer).toContainText("Demo Dispatcher");
    await expect(drawer).toContainText("import.vehicles");
    await expect(drawer).toContainText("Imported");
    await expect(drawer).toContainText("12");
    await expect(
      drawer.getByRole("button", { name: /Copy entity id/i }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-detail");

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(page).not.toHaveURL(/entry=/);
    await expect(open).toBeFocused();
  });

  test("restores a deep-linked entry", async ({ page }) => {
    await asRole(page, "admin", "entry=206");
    await expect(page).toHaveURL(/entry=206/);
    const drawer = page.getByRole("complementary", { name: "Audit entry details" });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("Import vehicles");
  });

  test("shows a not-found drawer for an entry beyond the lookup", async ({ page }) => {
    await asRole(page, "admin", "entry=999");
    await expect(page.getByText("Audit entry not found")).toBeVisible();
    await expect(
      page.getByText("It may be older than the 500 most recent entries."),
    ).toBeVisible();
  });

  test("pages a large log 100, 100 and 5 rows", async ({ page }) => {
    await setScenario(page, "large");
    await asRole(page, "admin");
    test.setTimeout(60_000);

    await expect(page.getByTestId("audit-page")).toContainText("100 entries loaded");
    await page.getByRole("button", { name: "Load more" }).click();
    await expect(page.getByTestId("audit-page")).toContainText("200 entries loaded");
    await page.getByRole("button", { name: "Load more" }).click();
    await expect(page.getByTestId("audit-page")).toContainText("205 entries loaded");
    await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
  });

  test("refresh picks up a new entry without duplicating rows", async ({ page }) => {
    await asRole(page, "admin");
    await expect(page.getByTestId("audit-page")).toContainText("12 entries loaded");

    await appendEntry(page);
    await page.getByRole("button", { name: "Refresh" }).click();

    await expect(page.getByTestId("audit-page")).toContainText("13 entries loaded");
    await expect(row(page, "User role change")).toHaveCount(1);
    await expect(page.getByRole("row").nth(1)).toContainText("User role change");
  });

  test("keeps cached rows offline and restores the live controls on reconnect", async ({
    page,
    context,
  }) => {
    await asRole(page, "admin");

    await context.setOffline(true);
    await expect(page.getByText(/Stale ·/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Refresh" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(
      page.getByRole("row").filter({ hasText: "Demo Admin" }).first(),
    ).toBeVisible();
    await captureForReview(page, "12-audit-stale");

    await context.setOffline(false);
    await expect(page.getByText(/Stale ·/)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Refresh" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  test("an empty log has a no-data state", async ({ page }) => {
    await asRole(page, "admin", "empty=audit");
    await expect(page.getByText("No audit entries yet")).toBeVisible();
    await expect(page.getByTestId("audit-page")).toContainText("0 entries loaded");
    await expectNoAxeViolations(page);
    await captureForReview(page, "12-audit-empty");
  });

  test("unknown actions and entities are humanised without a crash", async ({ page }) => {
    await setScenario(page, "unknown");
    await asRole(page, "admin");

    await expect(row(page, "User role change")).toHaveCount(1);
    await expect(row(page, "Maintenance job")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: /Open audit entry: User role change/i }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

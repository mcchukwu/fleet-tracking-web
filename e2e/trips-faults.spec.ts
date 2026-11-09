import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations } from "./helpers";

async function gotoFault(page: Page, fault: string, extra = ""): Promise<void> {
  await page.goto(`/trips?fault=${encodeURIComponent(fault)}${extra ? `&${extra}` : ""}`);
  await expect(page.getByRole("heading", { name: "Trips" })).toBeVisible();
}

async function clearFault(page: Page): Promise<void> {
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("fault");
    history.replaceState({}, "", `${url.pathname}${url.search}`);
  });
}

async function refetchWithFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
  });
}

async function fillCreate(page: Page): Promise<void> {
  const create = page.getByRole("dialog").filter({ hasText: "Create trip" });
  await create.getByLabel("Vehicle").click();
  await create.getByRole("option", { name: /LSD-100-AA/ }).first().click();
  await create.getByLabel("Origin").fill("Refinery Gate");
  await create.getByLabel("Destination").fill("Ibadan Customer");
  await create.getByRole("button", { name: "Create trip" }).click();
}

test.describe("trips faults", () => {
  test("a server error with nothing cached shows the region error and Retry recovers", async ({
    page,
  }) => {
    await gotoFault(page, "trips:server");
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Retry", exact: true }).first()).toBeVisible();
    await expect(page.getByText("Something broke.")).toHaveCount(0);
    await captureForReview(page, "06-trips-error");
    await expectNoAxeViolations(page);

    await clearFault(page);
    await page.getByRole("button", { name: "Retry", exact: true }).first().click();
    await expect(page.getByTestId("trips-page")).toContainText("5 loaded", {
      timeout: 15_000,
    });
  });

  test("a refresh error keeps the cached rows and labels them", async ({ page }) => {
    await page.goto("/trips");
    await expect(page.getByTestId("trips-page")).toContainText("5 loaded");

    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "trips:server");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await refetchWithFocus(page);

    await expect(page.getByText("Couldn't refresh")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Open trip to .* for LSD-100-AA/ })).toHaveCount(
      1,
    );
    await captureForReview(page, "06-trips-stale-error");
  });

  test("offline keeps cached rows, marks them stale and disables writes", async ({
    page,
    context,
  }) => {
    await page.goto("/trips");
    await expect(page.getByTestId("trips-page")).toContainText("5 loaded");

    await context.setOffline(true);
    await expect(page.getByText("You're offline", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Stale ·/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Create trip" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(
      page.getByRole("button", { name: /Complete|Start|Assign driver/ }).first(),
    ).toHaveAttribute("aria-disabled", "true");
    await captureForReview(page, "06-trips-offline");
    await expectNoAxeViolations(page);
    await context.setOffline(false);
  });

  test("a slow list shows the working state and Cancel stops waiting", async ({ page }) => {
    test.setTimeout(30_000);
    await gotoFault(page, "trips:slow");
    await expect(page.getByText("Still working…")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("Taking longer than usual")).toBeVisible({
      timeout: 12_000,
    });
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Still working…")).toHaveCount(0);
    await expect(page.getByText("Taking longer than usual")).toHaveCount(0);
    await expect(page.getByText("Loading cancelled")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("a forbidden list shows the forbidden state with a way back", async ({ page }) => {
    await gotoFault(page, "trips:forbidden");
    await expect(page.getByText("You don't have access to this.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go back" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("a malformed body degrades to a contract error with diagnostics", async ({ page }) => {
    await gotoFault(page, "trips:malformed");
    await expect(page.getByText("Unexpected response from the server").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Copy diagnostics" })).toBeVisible();
    await expect(page.getByText(/Unexpected token|JSON/)).toHaveCount(0);
  });

  test("an unknown status renders the neutral fallback without actions", async ({ page }) => {
    await gotoFault(page, "trips:unknown_enum");
    await expect(page.getByText("Unknown status: diverted")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Vehicle" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Complete|Start|Assign driver/ })).toHaveCount(0);
  });

  test("a lost create reports that it was not saved and creates no duplicate", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/trips");
    await expect(page.getByTestId("trips-page")).toContainText("5 loaded");
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "trips-post:lost");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });

    await page.getByRole("button", { name: "Create trip" }).click();
    await fillCreate(page);

    await expect(page.getByText("It wasn't saved.").first()).toBeVisible({
      timeout: 45_000,
    });
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(0);
    await expect(page.getByTestId("trips-page")).toContainText("5 loaded");
  });

  test("a lost transition reports that it was not saved", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/trips");
    const active = page
      .getByRole("row")
      .filter({ hasText: "LSD-101-AA" })
      .filter({ hasText: "Active" });
    await expect(active).toBeVisible();
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "trips-patch:lost");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });

    await active.getByRole("button", { name: "Complete LSD-101-AA" }).click();
    const confirm = page.getByRole("dialog").filter({ hasText: "Complete trip" });
    await confirm.getByRole("button", { name: "Complete trip" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "It wasn't saved." })).toBeVisible({
      timeout: 45_000,
    });
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(0);
  });

  test("a render crash is contained by the route boundary", async ({ page }) => {
    await page.goto("/trips?crash=trips");
    await expect(page.getByText("This part of the page stopped working")).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await captureForReview(page, "06-trips-crash");
  });
});

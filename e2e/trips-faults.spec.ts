import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations } from "./helpers";

async function gotoFault(page: Page, fault: string, extra = ""): Promise<void> {
  await page.goto(`/trips?fault=${encodeURIComponent(fault)}${extra ? `&${extra}` : ""}`);
  await expect(page.getByRole("heading", { name: "Trips" })).toBeVisible({
    timeout: 15_000,
  });
}

async function expectLoaded(page: Page): Promise<void> {
  await expect(page.getByTestId("trips-page")).toContainText("5 loaded", {
    timeout: 15_000,
  });
}

async function clearFault(page: Page): Promise<void> {
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("fault");
    history.replaceState({}, "", `${url.pathname}${url.search}`);
  });
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

function unexpectedConsole(errors: string[]): string[] {
  return errors.filter(
    (text) => !text.includes("above error occurred") && !text.includes("Failed to load resource"),
  );
}

async function fillCreate(page: Page): Promise<void> {
  const create = page.getByRole("dialog").filter({ hasText: "Create trip" });
  await create.getByLabel("Vehicle").click();
  await page
    .getByRole("option", { name: /LSD-100-AA/ })
    .first()
    .click();
  await create.getByLabel("Origin").fill("Refinery Gate");
  await create.getByLabel("Destination").fill("Ibadan Customer");
  await create.getByRole("button", { name: "Create trip" }).click();
}

test.describe("trips faults", () => {
  test("a server error with nothing cached shows the region error and Retry recovers", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await gotoFault(page, "trips:server");
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Retry", exact: true }).first()).toBeVisible();
    await expect(page.getByText("Something broke.")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await captureForReview(page, "06-trips-error");
    await expectNoAxeViolations(page);

    await clearFault(page);
    await page.getByRole("button", { name: "Retry", exact: true }).first().click();
    await expect(page.getByTestId("trips-page")).toContainText("5 loaded", {
      timeout: 15_000,
    });
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a refresh error keeps the cached rows and labels them", async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto("/trips");
    await expectLoaded(page);

    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "trips:server");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });

    // The 15s interval is the deterministic refresh path; a synthetic focus
    // event is ignored in headless Chromium when the page already has focus.
    await expect(page.getByText("Couldn't refresh")).toBeVisible({ timeout: 30_000 });
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
    await expectLoaded(page);

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

  test("offline with cached rows and no filter match keeps the filtered empty state", async ({
    page,
    context,
  }) => {
    await page.goto("/trips");
    await expectLoaded(page);

    await context.setOffline(true);
    await expect(page.getByText("You're offline", { exact: false }).first()).toBeVisible();
    await page.getByLabel("Search trips").fill("NO-SUCH-TRIP");

    await expect(page.getByText("No trips match")).toBeVisible();
    await expect(page.getByText("No trips available offline")).toHaveCount(0);
    await expectNoAxeViolations(page);
    await context.setOffline(false);
  });

  test("offline with no cache shows the neutral empty state", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    });
    await page.goto("/trips?fault=trips%3Anetwork");

    await expect(page.getByText("You're offline")).toBeVisible();
    await expect(page.getByText("No trips available offline")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("No trips yet")).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test("a slow list shows the working state and Cancel stops waiting", async ({ page }) => {
    test.setTimeout(40_000);
    await gotoFault(page, "trips:slow");
    await expect(page.getByText("Still working…")).toBeVisible({ timeout: 8_000 });
    await expectNoAxeViolations(page);
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
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await expectNoAxeViolations(page);
  });

  test("an unknown status renders the neutral fallback without actions", async ({ page }) => {
    await gotoFault(page, "trips:unknown_enum");
    await expect(page.getByText("Unknown status: diverted")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Vehicle" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Complete|Start|Assign driver/ })).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test("a lost create reports that it was not saved and creates no duplicate", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await page.goto("/trips");
    await expectLoaded(page);
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
    await expect
      .poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))))
      .toBe(true);
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(0);
    await expectLoaded(page);
    expect(unexpectedConsole(errors)).toEqual([]);
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

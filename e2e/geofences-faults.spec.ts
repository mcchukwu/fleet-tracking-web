import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations, expectNoHorizontalScroll } from "./helpers";

async function gotoFault(page: Page, fault: string, extra = ""): Promise<void> {
  await page.goto(
    `/geofences?map=fake&fault=${encodeURIComponent(fault)}${extra ? `&${extra}` : ""}`,
  );
  await expect(page.getByRole("heading", { name: "Geofences" })).toBeVisible({
    timeout: 15_000,
  });
}

async function expectLoaded(page: Page): Promise<void> {
  await expect(page.getByTestId("geofences-page")).toContainText("4 geofences", {
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

// Several tests poll a 45s reconciliation window plus a full page render; the
// default 30s is too tight for the parallel four-project gate.
test.describe.configure({ timeout: 60_000 });

function row(page: Page, name: string) {
  return page
    .getByRole("list", { name: "Geofences" })
    .getByRole("button", { name: new RegExp(name) });
}

async function clickMapPoint(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId("fleet-map-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("map canvas has no box");
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
}

async function drawTriangle(page: Page): Promise<void> {
  await clickMapPoint(page, 0.35, 0.4);
  await clickMapPoint(page, 0.55, 0.4);
  await clickMapPoint(page, 0.45, 0.58);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Polygon ready.")).toBeVisible();
}

test.describe("geofences faults", () => {
  test("a server error with nothing cached shows the region error and Retry recovers", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await gotoFault(page, "geofences:server");
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    await expect(page.getByText("Something broke.")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await captureForReview(page, "08-geofences-fault-error");
    await expectNoAxeViolations(page);

    await clearFault(page);
    await page.getByRole("button", { name: "Retry" }).first().click();
    await expectLoaded(page);
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a cached refresh error keeps the rows and offers Retry", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/geofences?map=fake");
    await expectLoaded(page);
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "geofences:server");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
      // Force a reconnect: React Query refetches stale queries on reconnect.
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
      window.dispatchEvent(new Event("offline"));
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
      window.dispatchEvent(new Event("online"));
    });

    await expect(page.getByText("Couldn't refresh")).toBeVisible({ timeout: 15_000 });
    await expect(row(page, "Border")).toBeVisible();
    await expect(page.getByText(/Stale ·/)).toBeVisible();
    await captureForReview(page, "08-geofences-fault-refresh");
    await expectNoAxeViolations(page);
  });

  test("a broken slow list shows the working state and Cancel stops waiting", async ({ page }) => {
    test.setTimeout(40_000);
    await gotoFault(page, "geofences:slow");
    await expect(page.getByText("Still working…")).toBeVisible({ timeout: 8_000 });
    await expectNoAxeViolations(page);
    await expect(page.getByText("Taking longer than usual")).toBeVisible({ timeout: 12_000 });
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Still working…")).toHaveCount(0);
    await expect(page.getByText("Loading cancelled")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("a forbidden list shows the forbidden state with a way back", async ({ page }) => {
    await gotoFault(page, "geofences:forbidden");
    await expect(page.getByText("You don't have access to this.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go back" })).toBeVisible();
    await captureForReview(page, "08-geofences-forbidden");
    await expectNoAxeViolations(page);
  });

  test("a malformed body degrades to a contract error with diagnostics", async ({ page }) => {
    await gotoFault(page, "geofences:malformed");
    await expect(page.getByText("Unexpected response from the server").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Copy diagnostics" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("an unknown kind falls back to Other and keeps the row", async ({ page }) => {
    await gotoFault(page, "geofences:unknown_enum");
    await expect(row(page, "Other")).toBeVisible();
    await expect(page.getByText("Other")).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("offline with cached rows keeps the list and disables writes", async ({ page }) => {
    await page.goto("/geofences?map=fake");
    await expectLoaded(page);
    await page.evaluate(() => window.__FLEET_TEST_CONNECTION__?.({ network: "offline" }));
    await expect(row(page, "Border")).toBeVisible();
    await expect(page.getByText(/Stale ·/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Geofence map" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create geofence" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await captureForReview(page, "08-geofences-offline");
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);

    await page.evaluate(() => window.__FLEET_TEST_CONNECTION__?.({ network: "online" }));
    await expect(row(page, "Border")).toBeVisible();
  });

  test("offline with no cache shows the neutral empty state", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    });
    await page.goto("/geofences?map=fake&fault=geofences%3Anetwork");
    await expect(page.getByText("No geofences available offline")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Reconnect to load the geofence list.")).toBeVisible();
    await expect(page.getByText("Can't reach the server")).toHaveCount(0);
    await captureForReview(page, "08-geofences-offline-empty");
  });

  test("a create 400 keeps the form and drawing with the server detail", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/geofences?map=fake");
    await expectLoaded(page);
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "geofences-post:validation");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await page.getByRole("button", { name: "Create geofence" }).click();
    const form = page.getByRole("form", { name: "New geofence" });
    await drawTriangle(page);
    await form.getByLabel("Name").fill("Rejected Gate");
    await form.getByRole("button", { name: "Create geofence" }).click();

    await expect(page.getByText("Check the highlighted fields").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Check the fields.")).toBeVisible();
    await expect(form).toBeVisible();
    await expect(page.getByText("Polygon ready.")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Check the request body/);
  });

  test("an edit 404 keeps the form and offers Refresh", async ({ page }) => {
    await page.goto("/geofences?map=fake");
    await expectLoaded(page);
    await row(page, "Border").click();
    await page.getByRole("button", { name: "Edit" }).click();
    const form = page.getByRole("form", { name: "Edit geofence" });
    await form.getByLabel("Name").fill("Border North");
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "geofences-patch:not_found");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await form.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("This geofence no longer exists.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect(form).toBeVisible();
  });

  test("a lost create reports that it was not saved and creates no duplicate", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await page.goto("/geofences?map=fake");
    await expectLoaded(page);
    await page.getByRole("button", { name: "Create geofence" }).click();
    const form = page.getByRole("form", { name: "New geofence" });
    await drawTriangle(page);
    await form.getByLabel("Name").fill("Lost Gate");
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "geofences-post:lost");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await form.getByRole("button", { name: "Create geofence" }).click();

    await expect(page.getByText("It wasn't saved.").first()).toBeVisible({ timeout: 45_000 });
    await expect(form).toBeVisible();
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(0);
    await expect(row(page, "Lost Gate")).toHaveCount(0);
    await expect(page.getByTestId("geofences-page")).toContainText("4 geofences");
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a lost update reports that it was not saved and keeps the row", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/geofences?map=fake");
    await expectLoaded(page);
    await row(page, "Border").click();
    await page.getByRole("button", { name: "Edit" }).click();
    const form = page.getByRole("form", { name: "Edit geofence" });
    await form.getByLabel("Name").fill("Border North");
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "geofences-patch:lost");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await form.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("It wasn't saved.").first()).toBeVisible({ timeout: 45_000 });
    await expect(form).toBeVisible();
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(0);
    await form.getByRole("button", { name: "Cancel" }).click();
    await page
      .getByRole("dialog", { name: "Discard changes?" })
      .getByRole("button", { name: "Discard" })
      .click();
    await expect(row(page, "Border")).toBeVisible();
    await expect(row(page, "Border North")).toHaveCount(0);
  });

  test("a session expiry during a write keeps the form and asks to sign in", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/geofences?map=fake");
    await expectLoaded(page);
    await row(page, "Border").click();
    await page.getByRole("button", { name: "Edit" }).click();
    const form = page.locator('form[aria-label="Edit geofence"]');
    await form.getByLabel("Name").fill("Border North");
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "geofences-patch:unauthenticated");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await form.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("dialog", { name: "Your session expired" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(form).toHaveCount(1);
    await expect(form.getByLabel("Name")).toHaveValue("Border North");
    await expect(page.getByText("Sign in, then try again.")).toHaveCount(1);
  });

  test("a lost delete reports that it was not deleted and keeps the row", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/geofences?map=fake");
    await expectLoaded(page);
    await row(page, "Border").click();
    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("dialog", { name: 'Delete geofence "Border"?' });
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "geofences-delete:lost");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(dialog.getByText("It wasn't deleted.")).toBeVisible({ timeout: 45_000 });
    await expect(dialog).toBeVisible();
    await expect(page.locator("[data-geofence-row]").filter({ hasText: "Border" })).toBeVisible();
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(0);
  });

  test("a render crash is contained by the route boundary", async ({ page }) => {
    await page.goto("/geofences?map=fake&crash=geofences");
    await expect(page.getByText("This part of the page stopped working")).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await captureForReview(page, "08-geofences-crash");
  });
});

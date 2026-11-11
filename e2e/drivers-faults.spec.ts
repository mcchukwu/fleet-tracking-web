import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations, expectNoHorizontalScroll } from "./helpers";

async function gotoFault(page: Page, fault: string, extra = ""): Promise<void> {
  await page.goto(`/drivers?fault=${encodeURIComponent(fault)}${extra ? `&${extra}` : ""}`);
  await expect(page.getByRole("heading", { name: "Drivers" })).toBeVisible({
    timeout: 15_000,
  });
}

async function expectLoaded(page: Page): Promise<void> {
  await expect(page.getByTestId("drivers-page")).toContainText("26 drivers", {
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
    (text) =>
      !text.includes("above error occurred") && !text.includes("Failed to load resource"),
  );
}

async function openEdit(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /Open driver Test Driver Six/ })
    .first()
    .click();
  await page
    .getByRole("complementary", { name: "Driver details" })
    .getByRole("button", { name: "Edit driver" })
    .click();
  await expect(page.getByRole("dialog", { name: "Edit driver" })).toBeVisible();
}

test.describe("drivers faults", () => {
  test("a server error with nothing cached shows the region error and Retry recovers", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await gotoFault(page, "drivers:server");
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    await expect(page.getByText("Something broke.")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await captureForReview(page, "07-drivers-fault-error");
    await expectNoAxeViolations(page);

    await clearFault(page);
    await page.getByRole("button", { name: "Retry" }).first().click();
    await expectLoaded(page);
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a broken slow list shows the working state and Cancel stops waiting", async ({ page }) => {
    test.setTimeout(40_000);
    await gotoFault(page, "drivers:slow");
    await expect(page.getByText("Still working…")).toBeVisible({ timeout: 8_000 });
    await expectNoAxeViolations(page);
    await expect(page.getByText("Taking longer than usual")).toBeVisible({ timeout: 12_000 });
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Still working…")).toHaveCount(0);
    await expect(page.getByText("Loading cancelled")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("a forbidden list shows the forbidden state with a way back", async ({ page }) => {
    await gotoFault(page, "drivers:forbidden");
    await expect(page.getByText("You don't have access to this.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go back" })).toBeVisible();
    await captureForReview(page, "07-drivers-forbidden");
    await expectNoAxeViolations(page);
  });

  test("a malformed body degrades to a contract error with diagnostics", async ({ page }) => {
    await gotoFault(page, "drivers:malformed");
    await expect(page.getByText("Unexpected response from the server").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Copy diagnostics" })).toBeVisible();
    await expect(page.getByText(/Unexpected token|JSON/)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await captureForReview(page, "07-drivers-contract");
    await expectNoAxeViolations(page);
  });

  test("an unknown status renders the neutral fallback", async ({ page }) => {
    await gotoFault(page, "drivers:unknown_enum");
    await expect(page.getByText("Unknown status: suspended")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("a lost create reports that it was not saved and creates no duplicate", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await page.goto("/drivers");
    await expectLoaded(page);
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "drivers-post:lost");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });

    await page.getByRole("button", { name: "Create driver" }).click();
    const create = page.getByRole("dialog", { name: "Create driver" });
    await create.getByLabel("Name").fill("Lost Driver");
    await create.getByRole("button", { name: "Create driver" }).click();

    await expect(page.getByText("It wasn't saved.").first()).toBeVisible({
      timeout: 45_000,
    });
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))),
      )
      .toBe(true);
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(0);
    await expect(page.getByRole("dialog", { name: "Create driver" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await expectNoAxeViolations(page);
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a lost update reports that it was not saved and keeps the form", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await page.goto("/drivers");
    await expectLoaded(page);
    await openEdit(page);
    await page.getByRole("dialog", { name: "Edit driver" }).getByLabel("Phone").fill("0803 100 0199");

    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "drivers-patch:lost");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await page.getByRole("dialog", { name: "Edit driver" }).getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("It wasn't saved.").first()).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("dialog", { name: "Edit driver" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))),
      )
      .toBe(true);
    expect(await page.evaluate(() => window.__FLEET_MOCK_WRITES__ ?? [])).toHaveLength(0);
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await expectNoAxeViolations(page);
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a driver removed elsewhere shows not-found with Refresh", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/drivers");
    await expectLoaded(page);
    await openEdit(page);
    await page.getByRole("dialog", { name: "Edit driver" }).getByLabel("Phone").fill("0803 100 0198");

    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("fault", "drivers-patch:not_found");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
    await page.getByRole("dialog", { name: "Edit driver" }).getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("This driver no longer exists.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Edit driver" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))),
      )
      .toBe(true);
    await expect(page.locator("body")).not.toContainText(/\.tsx:\d+/);
    await expectNoAxeViolations(page);
    expect(unexpectedConsole(errors)).toEqual([]);
  });

  test("a render crash is contained by the route boundary", async ({ page }) => {
    await page.goto("/drivers?crash=drivers");
    await expect(page.getByText("This part of the page stopped working")).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await captureForReview(page, "07-drivers-crash");
  });
});

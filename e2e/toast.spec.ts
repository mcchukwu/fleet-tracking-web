import { expect, test } from "./fixtures";

test.describe("toasts", () => {
  test("a manual close does not make later non-error toasts persistent", async ({ page }) => {
    await page.goto("/styleguide");
    await page.locator("#toasts").scrollIntoViewIfNeeded();

    const toasts = page.getByRole("region", { name: /Notifications/ });

    await page.getByRole("button", { name: "Success toast" }).click();
    await expect(toasts.getByText("Trip created")).toBeVisible();
    await toasts.getByRole("button", { name: "Dismiss" }).click();
    await expect(toasts.getByText("Trip created")).toHaveCount(0);

    await page.getByRole("button", { name: "Info toast" }).click();
    await expect(toasts.getByText("Vehicle updated")).toBeVisible();
    await expect(toasts.getByText("Vehicle updated")).toHaveCount(0, {
      timeout: 6_000,
    });

    await page.getByRole("button", { name: "Error toast" }).click();
    await expect(toasts.getByText("Couldn't save")).toBeVisible();
    await page.waitForTimeout(4_500);
    await expect(toasts.getByText("Couldn't save")).toBeVisible();
  });
});

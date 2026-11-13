import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations, expectNoHorizontalScroll } from "./helpers";

/** The six-step demo story from `docs/ui-brief.md`, against the MSW fixtures. */

const PASSWORD = "DemoPass123!";
const GEOFENCE_EXIT = "fbad9142-c164-463d-ae76-3262f2d3b4f9";
const ROUTE_DEVIATION = "ac1a223c-f9b0-46f3-9ead-13a10bfd6389";

test.describe("demo story", { tag: "@theme" }, () => {
  test("login to a green system in six steps", async ({ page }) => {
    test.setTimeout(180_000);

    // 1. Sign in.
    await page.goto("/styleguide");
    await page.evaluate(() => localStorage.setItem("fleet.mockAuth", "anonymous"));
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("dispatcher@demo.ftb");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByTestId("map-root")).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded)).toBe(true);
    await captureForReview(page, "14-demo-map");

    // 2. The fleet and its geofences are on the map.
    await expect(page.getByText(/Showing 25 of 25/)).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.geofenceCount ?? 0))
      .toBeGreaterThan(0);
    await expectNoHorizontalScroll(page);

    // 3. The geofence-exit alert.
    await page.goto(`/alerts?alert=${GEOFENCE_EXIT}`);
    const exitDrawer = page.getByRole("complementary", { name: "Alert details" });
    await expect(exitDrawer.getByRole("heading", { name: "Geofence exit" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(exitDrawer.getByText("Ibadan Customer")).toBeVisible();
    await expect(exitDrawer.getByText("Geofence id")).toBeVisible();
    await expect(exitDrawer.getByRole("region", { name: "Alert position" })).not.toHaveAttribute(
      "aria-busy",
      "true",
    );
    await captureForReview(page, "14-demo-exit-alert");
    await expectNoAxeViolations(page);

    // 4. The deviation alert with its evidence and trip.
    await page.goto(`/alerts?alert=${ROUTE_DEVIATION}`);
    const deviationDrawer = page.getByRole("complementary", { name: "Alert details" });
    await expect(deviationDrawer.getByText("Refinery Gate → Ibadan Customer")).toBeVisible({
      timeout: 20_000,
    });
    await expect(deviationDrawer.getByRole("button", { name: "Raw JSON" })).toBeVisible();
    await captureForReview(page, "14-demo-deviation");
    await expectNoAxeViolations(page);

    // 5. Replay the segment from the deviation.
    await deviationDrawer.getByRole("button", { name: "Replay last 30 minutes" }).click();
    await expect(page).toHaveURL(/\/playback\?/);
    await expect(page.getByRole("region", { name: "Playback controls" })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.playback?.pointCount ?? 0), {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);
    await captureForReview(page, "14-demo-replay");

    // 6. Acknowledge the deviation, then import and check the system.
    await page.goto(`/alerts?status=open&alert=${ROUTE_DEVIATION}`);
    const ack = page
      .getByRole("complementary", { name: "Alert details" })
      .getByRole("button", { name: /Acknowledge/ });
    await ack.click();
    await expect(page.getByText("Acknowledged.").first()).toBeVisible({ timeout: 20_000 });
    await captureForReview(page, "14-demo-acknowledged");

    const csv = `imei,plate,vehicle_type,make,model,year,colour,depot
demo-story-1,DEMO-001-AA,truck,Volvo,FH,2022,White,Lagos`;
    await page.goto("/import");
    await page.getByTestId("import-file-input").setInputFiles({
      name: "demo.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByTestId("import-result-sentence")).toHaveText("1 vehicle imported.", {
      timeout: 20_000,
    });
    await captureForReview(page, "14-demo-import");

    await page.goto("/system");
    await expect(page.getByTestId("system-page")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("All systems healthy")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dependencies", level: 2 })).toBeVisible();
    await captureForReview(page, "14-demo-system");
    await expectNoAxeViolations(page);
  });
});

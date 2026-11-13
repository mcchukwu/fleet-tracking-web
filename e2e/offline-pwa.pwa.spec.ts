import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { expect, sessionUser, test } from "./pwa/fixtures";

async function waitForShell(page: Page): Promise<void> {
  await expect(page.getByTestId("map-root")).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.pwa.serviceWorker), {
      timeout: 30_000,
    })
    .not.toBe("unsupported");
}

async function waitForCache(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.pwa.cacheSavedAt ?? null), {
      timeout: 30_000,
    })
    .not.toBeNull();
}

async function clearCachedQueries(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keyval-store");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("keyval", "readwrite");
      transaction.objectStore("keyval").delete("fleet.query-cache");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
}

async function warmOnline(page: Page): Promise<void> {
  await page.goto("/map");
  await waitForShell(page);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    if (controlled) break;
    await page.reload();
    await waitForShell(page);
  }
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
      timeout: 60_000,
    })
    .toBe(true);
  await waitForCache(page);
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.pwa.mapCachedAt ?? null), {
      timeout: 60_000,
    })
    .not.toBeNull();
}

async function expectOfflineBoot(page: Page): Promise<void> {
  await expect(page.getByTestId("map-root")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("banner-region")).toContainText("You're offline", {
    timeout: 15_000,
  });
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.connection.network), {
      timeout: 15_000,
    })
    .toBe("offline");
}

test.describe("offline and PWA", () => {
  test("boots offline from the cached shell, data and map", async ({ page, context, pwa }) => {
    await warmOnline(page);
    const before = pwa.apiRequests.length;

    pwa.setOffline(true);
    await context.setOffline(true);
    await page.reload();

    await expectOfflineBoot(page);
    await expect(page.getByTestId("banner-region")).toContainText("Showing data from");
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), {
        timeout: 30_000,
      })
      .toBe(true);
    await expect(page.getByTestId("map-attribution")).toBeVisible();

    const offlineRequests = pwa.apiRequests.slice(before);
    expect(offlineRequests.filter((request) => request.path === "/live/snapshot")).toHaveLength(0);
  });

  test("disables mutations while offline with the offline reason", async ({
    page,
    context,
    pwa,
  }) => {
    await warmOnline(page);
    pwa.setOffline(true);
    await context.setOffline(true);

    await page.goto("/alerts");
    await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
    await expect(page.getByTestId("banner-region")).toContainText("You're offline");

    await page.goto("/trips");
    const create = page.getByRole("button", { name: "Create trip" });
    await expect(create).toHaveAttribute("aria-disabled", "true");
    await create.hover();
    await expect(page.getByRole("tooltip")).toContainText("You're offline.");
  });

  test("boots offline with no cached data into neutral empty states", async ({
    page,
    context,
    pwa,
  }) => {
    await warmOnline(page);
    await clearCachedQueries(page);

    pwa.setOffline(true);
    await context.setOffline(true);
    await page.reload();
    await expectOfflineBoot(page);

    await expect(page.getByText("No vehicles available offline")).toBeVisible();
    await expect(page.getByLabel("Loading vehicles")).toHaveCount(0);

    await page.getByRole("button", { name: `Account menu for ${sessionUser.name}` }).click();
    await expect(page.getByText("Unverified offline")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/alerts");
    await expect(page.getByText("No alerts available offline")).toBeVisible();
    await expect(page.getByLabel("Loading alerts")).toHaveCount(0);
  });

  test("a cold offline vehicle deep link shows no skeleton and no invented error", async ({
    page,
    context,
    pwa,
  }) => {
    test.skip(
      page.viewportSize()?.width !== 390,
      "The mobile detail sheet is the surface under test.",
    );
    await warmOnline(page);
    await clearCachedQueries(page);

    const vehicleId = "4324a768-9b14-4223-a299-eb8da4d8d309";
    pwa.setOffline(true);
    await context.setOffline(true);
    await page.goto(`/?v=${vehicleId}`);

    await expectOfflineBoot(page);
    await expect(page).toHaveURL(new RegExp(`/map\\?v=${vehicleId}`));
    await expect(page.getByTestId("vehicle-detail-sheet")).toBeVisible();

    await page.waitForTimeout(1_000);
    await expect(page.getByLabel("Loading vehicle details")).toHaveCount(0);
    await expect(page.getByText("Full vehicle details need a connection.")).toBeVisible();
    await expect(page.getByText("Still working…")).toHaveCount(0);
    await expect(page.getByText("Taking longer than usual")).toHaveCount(0);
  });

  test("a cold offline vehicle deep link keeps the cached snapshot row and its driver", async ({
    page,
    context,
    pwa,
  }) => {
    test.skip(
      page.viewportSize()?.width !== 390,
      "The mobile detail sheet is the surface under test.",
    );
    await warmOnline(page);

    const vehicleId = "4324a768-9b14-4223-a299-eb8da4d8d309";
    expect(
      pwa.apiRequests.filter((request) => request.path === `/vehicles/${vehicleId}`),
    ).toHaveLength(0);

    pwa.setOffline(true);
    await context.setOffline(true);
    await page.goto(`/?v=${vehicleId}`);

    await expectOfflineBoot(page);
    const sheet = page.getByTestId("vehicle-detail-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Adebayo Okafor")).toBeVisible();
    await expect(sheet.getByText("Full vehicle details need a connection.")).toBeVisible();
    await expect(page.getByLabel("Loading vehicle details")).toHaveCount(0);
  });

  test("verifies the session and resumes live data on reconnect", async ({
    page,
    context,
    pwa,
  }) => {
    await warmOnline(page);
    pwa.setOffline(true);
    await context.setOffline(true);
    await page.reload();
    await expectOfflineBoot(page);

    const before = pwa.apiRequests.length;
    pwa.setOffline(false);
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.connection.network), {
        timeout: 20_000,
      })
      .toBe("online");
    await expect(page.getByTestId("banner-region")).not.toContainText("You're offline", {
      timeout: 15_000,
    });
    expect(pwa.apiRequests.slice(before).some((request) => request.path === "/live/snapshot")).toBe(
      true,
    );
  });

  test("prompts before activating a new service worker", async ({ page }) => {
    await warmOnline(page);
    const swPath = join(process.cwd(), "dist", "sw.js");
    const original = await readFile(swPath, "utf8");

    try {
      await writeFile(swPath, `${original}\n// pwa-revision-${Date.now()}\n`);
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      });

      await expect(page.getByTestId("banner-region")).toContainText("A new version is available", {
        timeout: 60_000,
      });

      const urlBefore = page.url();
      await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
      expect(page.url()).toBe(urlBefore);

      await page.getByRole("button", { name: "Reload" }).click();
      await expect(page.getByTestId("map-root")).toBeVisible({ timeout: 30_000 });
    } finally {
      await writeFile(swPath, original);
    }
  });

  test("manifest and install prompt are available in Chromium", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "The installability API is Chromium-only.");
    await warmOnline(page);

    const manifest = await page.evaluate(async () => {
      const response = await fetch("/manifest.webmanifest");
      return response.json() as Promise<{
        name: string;
        display: string;
        icons: Array<{ src: string; sizes: string }>;
      }>;
    });
    expect(manifest.name).toBe("Fleet Console");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.map((icon) => icon.src)).toContain("/icons/icon-maskable-512.png");

    const cdp = await page.context().newCDPSession(page);
    const errors = (await cdp.send("Page.getInstallabilityErrors")) as {
      installabilityErrors: unknown[];
    };
    expect(errors.installabilityErrors).toEqual([]);

    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
      });
      window.dispatchEvent(event);
    });

    await page.getByRole("button", { name: `Account menu for ${sessionUser.name}` }).click();
    await expect(page.getByRole("menuitem", { name: "Install app" })).toBeVisible();
  });

  test("sign-out wipes the cached profile and tenant data", async ({ page, context, pwa }) => {
    await warmOnline(page);

    await page.getByRole("button", { name: `Account menu for ${sessionUser.name}` }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    pwa.setOffline(true);
    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("You're offline", { exact: false })).toBeVisible();
    await expect(page.getByTestId("map-root")).toHaveCount(0);
  });

  test("audit and uncached playback stay honestly unavailable offline", async ({
    page,
    context,
    pwa,
  }) => {
    await warmOnline(page);
    pwa.setOffline(true);
    await context.setOffline(true);
    await page.reload();
    await expectOfflineBoot(page);

    await page.goto("/audit");
    await expect(page.getByText("Audit isn't available offline")).toBeVisible();

    const vehicleId = "4324a768-9b14-4223-a299-eb8da4d8d309";
    await page.goto(
      `/playback?vehicle=${vehicleId}&from=2026-11-03T06:00:00.000Z&to=2026-11-03T09:00:00.000Z`,
    );
    await expect(page.getByText("Not available offline")).toBeVisible({ timeout: 15_000 });
  });
});

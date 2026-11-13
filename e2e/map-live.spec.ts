import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview } from "./helpers";

async function gotoLiveMap(page: Page, search = ""): Promise<void> {
  await page.goto(`/map?map=fake${search ? `&${search}` : ""}`);
  await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), { timeout: 15_000 })
    .toBe(true);
}

async function waitForLive(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.connection.socket), { timeout: 20_000 })
    .toBe("live");
}

async function waitForPosition(page: Page, key: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          (vehicle) => window.__FLEET_DEBUG__?.live.positions[vehicle]?.positionAt ?? 0,
          key,
        ),
      {
        timeout: 15_000,
      },
    )
    .toBeGreaterThan(0);
}

function position(key: string, recordedAt: string) {
  return {
    type: "position",
    tenant_id: "tenant-demo",
    vehicle_id: key,
    lat: 6.6,
    lon: 3.5,
    recorded_at: recordedAt,
  };
}

test.describe("live feed", () => {
  test("a position frame moves the vehicle and an older frame is ignored", async ({
    page,
    liveSocket,
  }) => {
    await gotoLiveMap(page);
    await waitForLive(page);
    await waitForPosition(page, "demo-imei-0019");
    const before = await page.evaluate(
      () => window.__FLEET_DEBUG__?.live.positions["demo-imei-0019"]?.positionAt ?? 0,
    );

    await liveSocket.send(position("demo-imei-0019", new Date().toISOString()));
    await expect
      .poll(() =>
        page.evaluate(() => window.__FLEET_DEBUG__?.live.positions["demo-imei-0019"]?.lat),
      )
      .toBe(6.6);

    await liveSocket.send(position("demo-imei-0019", new Date(Date.now() - 60_000).toISOString()));
    await expect
      .poll(() =>
        page.evaluate(() => window.__FLEET_DEBUG__?.live.positions["demo-imei-0019"]?.lat),
      )
      .toBe(6.6);
    await expect
      .poll(() =>
        page.evaluate(() => window.__FLEET_DEBUG__?.live.positions["demo-imei-0019"]?.positionAt),
      )
      .toBeGreaterThan(before);
  });

  test("a dropped socket reconnects and refetches the snapshot first", async ({
    page,
    liveSocket,
  }) => {
    let snapshots = 0;
    page.on("request", (request) => {
      if (request.url().includes("/live/snapshot")) snapshots += 1;
    });

    await gotoLiveMap(page);
    await waitForLive(page);
    await waitForPosition(page, "demo-imei-0019");
    const before = snapshots;

    await liveSocket.close();
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.connection.socket))
      .toBe("reconnecting");
    await expect.poll(() => snapshots).toBeGreaterThan(before);
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.connection.socket), {
        timeout: 20_000,
      })
      .toBe("live");
  });

  test("an alert frame raises a toast, announces and refreshes the open count", async ({
    page,
    liveSocket,
  }) => {
    await gotoLiveMap(page);
    await waitForLive(page);
    await waitForPosition(page, "demo-imei-0002");
    const titleBefore = await page.title();
    const openBefore = Number(/\((\d+)\)/.exec(titleBefore)?.[1] ?? 0);

    await page.evaluate(() =>
      fetch("/api/v1/__mock/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: "demo-imei-0002" }),
      }),
    );

    await liveSocket.send({
      type: "alert",
      tenant_id: "tenant-demo",
      vehicle_id: "demo-imei-0002",
      alert: {
        type: "geofence_exit",
        severity: "high",
        occurred_at: new Date().toISOString(),
      },
    });

    await expect(page.getByText("Geofence exit").first()).toBeVisible();
    await expect(
      page.locator('[aria-live="polite"]').filter({ hasText: "Geofence exit" }).first(),
    ).toBeAttached();

    expect(titleBefore).not.toContain(`(${openBefore + 1})`);
    await expect.poll(() => page.title(), { timeout: 15_000 }).toContain(`(${openBefore + 1})`);
    await captureForReview(page, "02-map-alert-toast");
  });

  test("a burst of alert frames produces one summary toast", async ({ page, liveSocket }) => {
    await gotoLiveMap(page);
    await waitForLive(page);
    await waitForPosition(page, "demo-imei-0002");
    const socket = liveSocket.latest();
    if (!socket) throw new Error("The live socket is not connected");

    for (let index = 0; index < 12; index += 1) {
      socket.send(
        JSON.stringify({
          type: "alert",
          tenant_id: "tenant-demo",
          vehicle_id: `demo-imei-00${String(10 + (index % 9)).padStart(2, "0")}`,
          alert: {
            type: "speeding",
            severity: "medium",
            occurred_at: new Date(Date.now() - index * 1_000).toISOString(),
          },
        }),
      );
    }

    await expect(page.getByText("12 new alerts").first()).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[data-layer-portal="toast"]').getByText("12 new alerts"),
    ).toHaveCount(1);
    await expect(
      page.locator('[aria-live="polite"]').filter({ hasText: "12 new alerts" }).first(),
    ).toBeAttached();
  });

  test("a silent stream is marked stale without dropping the socket", async ({ page }) => {
    await gotoLiveMap(page);
    await waitForLive(page);
    await waitForPosition(page, "demo-imei-0019");

    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.stale), { timeout: 20_000 })
      .toBe(true);
    expect(await page.evaluate(() => window.__FLEET_DEBUG__?.connection.socket)).toBe("live");
  });

  test("5,000-vehicle stress mode keeps frame work out of the per-message path", async ({
    page,
    liveSocket,
  }) => {
    test.setTimeout(120_000);
    await gotoLiveMap(page, "perf=5000");
    await waitForLive(page);
    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.targetVehicleCount), {
        timeout: 30_000,
      })
      .toBe(5_000);

    await page.evaluate(() => {
      const probe = window as Window & { __mapLongTasks?: number[] };
      probe.__mapLongTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) probe.__mapLongTasks?.push(entry.duration);
      }).observe({ entryTypes: ["longtask"] });
    });

    const socket = liveSocket.latest();
    if (!socket) throw new Error("The live socket is not connected");
    const now = Date.now();
    for (let index = 0; index < 500; index += 1) {
      socket.send(
        JSON.stringify({
          type: "position",
          tenant_id: "tenant-demo",
          vehicle_id: `perf-imei-${index}`,
          lat: 6.4 + (index % 100) * 0.001,
          lon: 3.3 + Math.floor(index / 100) * 0.001,
          recorded_at: new Date(now + index).toISOString(),
        }),
      );
    }

    await expect
      .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.live.frameCount ?? 0), {
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(500);
    const stats = await page.evaluate(() => window.__FLEET_DEBUG__?.live);
    expect(stats?.batchCount ?? 0).toBeGreaterThan(0);
    expect(stats?.frameCount ?? 0).toBeGreaterThan((stats?.batchCount ?? 1) * 5);

    const longest = await page.evaluate(() =>
      Math.max(0, ...((window as Window & { __mapLongTasks?: number[] }).__mapLongTasks ?? [])),
    );
    expect(longest, `longest main-thread task ${longest}ms`).toBeLessThan(500);
  });
});

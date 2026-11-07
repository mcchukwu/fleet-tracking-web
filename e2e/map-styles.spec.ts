import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { captureForReview, expectNoAxeViolations } from "./helpers";

const SELECTED = "4324a768-9b14-4223-a299-eb8da4d8d309";

interface StyleOptions {
  streets?: "ok" | "403" | "pending";
  geofence?: boolean;
  realStyles?: boolean;
}

async function installStyleMock(page: Page, options: StyleOptions = {}): Promise<void> {
  await page.addInitScript((next: StyleOptions) => {
    const ATTRIBUTION =
      '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ' +
      '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>';

    const standard = (dark: boolean) => ({
      version: 8,
      name: dark ? "test-standard-dark" : "test-standard-light",
      glyphs: "https://fonts.test/{fontstack}/{range}.pbf",
      sources: {},
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": dark ? "#1f2933" : "#eef1f4" },
        },
      ],
    });

    const hosted = (name: string) => ({
      version: 8,
      name,
      glyphs: "https://fonts.test/{fontstack}/{range}.pbf",
      sources: {
        credit: {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          attribution: ATTRIBUTION,
        },
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": name.includes("dark") ? "#20262e" : "#dfe7ec" },
        },
      ],
    });

    const counts = { streets: 0, satellite: 0 };
    Object.defineProperty(window, "__STYLE_TEST__", { value: counts, configurable: true });

    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!next.realStyles && url.startsWith("https://styles.test/")) {
        return new Response(JSON.stringify(standard(url.includes("dark"))), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (!next.realStyles && url.startsWith("https://api.maptiler.com/maps/streets-v4")) {
        counts.streets += 1;
        if (next.streets === "403") return new Response("quota", { status: 403 });
        if (next.streets === "pending") {
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
        return new Response(
          JSON.stringify(hosted(url.includes("streets-v4-dark") ? "streets-dark" : "streets-light")),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (!next.realStyles && url.startsWith("https://api.maptiler.com/maps/hybrid-v4")) {
        counts.satellite += 1;
        return new Response(JSON.stringify(hosted("hybrid-v4")), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (next.geofence && url.includes("/api/v1/geofences")) {
        const lon = 3.799;
        const lat = 7.2058;
        const half = 0.006;
        const ring = [
          [lon - half, lat - half],
          [lon + half, lat - half],
          [lon + half, lat + half],
          [lon - half, lat + half],
          [lon - half, lat - half],
        ];
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "00000000-0000-0000-0000-000000000299",
                name: "Lekki Depot",
                kind: "depot",
                geometry: { type: "Polygon", coordinates: [ring] },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return original(input, init);
    };
  }, options);
}

async function styleCounts(page: Page): Promise<{ streets: number; satellite: number }> {
  return page.evaluate(() => window.__STYLE_TEST__ ?? { streets: 0, satellite: 0 });
}

async function gotoRealMap(page: Page): Promise<void> {
  await page.goto(`/map?v=${SELECTED}`);
  await expect(page.getByRole("region", { name: "Live map" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.mapLoaded), { timeout: 20_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__FLEET_DEBUG__?.map.targetVehicleCount), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
}

async function debugMap(page: Page) {
  return page.evaluate(() => window.__FLEET_DEBUG__?.map ?? null);
}

test.describe("MapTiler styles (real adapter)", () => {
  test("switches to Streets without losing the camera, selection or layers", async ({ page }) => {
    await installStyleMock(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const consoleLines: string[] = [];
    page.on("console", (message) => consoleLines.push(message.text()));
    await gotoRealMap(page);
    await expect.poll(async () => (await debugMap(page))?.geofenceCount).toBe(4);
    // The first fit runs once positions arrive; wait for it before comparing cameras.
    await expect
      .poll(async () => (await debugMap(page))?.viewport?.center[0] ?? 3.8)
      .not.toBeCloseTo(3.8, 3);
    const before = (await debugMap(page))?.viewport;

    await page.getByRole("button", { name: "Map style" }).click();
    await page.getByRole("menuitemradio", { name: "Streets" }).click();

    await expect.poll(async () => (await debugMap(page))?.styleState).toBe("ready");
    await expect.poll(async () => (await debugMap(page))?.activeStyle).toBe("streets");
    const after = (await debugMap(page))?.viewport;

    expect(after?.center[0]).toBeCloseTo(before?.center[0] ?? 0, 3);
    expect(after?.center[1]).toBeCloseTo(before?.center[1] ?? 0, 3);
    expect(after?.zoom).toBeCloseTo(before?.zoom ?? 0, 2);
    await expect.poll(async () => (await debugMap(page))?.selectedKey).toBe("demo-imei-0001");
    await expect.poll(async () => (await debugMap(page))?.geofenceCount).toBe(4);
    await expect.poll(async () => (await debugMap(page))?.targetVehicleCount).toBeGreaterThan(0);

    await expect(page.getByTestId("map-attribution")).toHaveText(
      "© MapTiler © OpenStreetMap contributors",
    );
    await expect(page.getByRole("link", { name: "MapTiler" })).toBeVisible();
    await expectNoAxeViolations(page);

    expect((await styleCounts(page)).streets).toBe(1);
    expect(consoleLines.filter((line) => line.includes("test-key"))).toEqual([]);
    await captureForReview(page, "maptiler-streets-real");
  });

  test("shows a loading state until the style arrives", async ({ page }) => {
    await installStyleMock(page, { streets: "pending" });
    await gotoRealMap(page);
    const trigger = page.getByRole("button", { name: "Map style" });

    await trigger.click();
    await page.getByRole("menuitemradio", { name: "Streets" }).click();
    await expect(trigger).toHaveAttribute("aria-busy", "true");
    await expect.poll(async () => (await debugMap(page))?.styleState).toBe("ready");
    await expect(trigger).toHaveAttribute("aria-busy", "false");
  });

  test("falls back to Map once when Streets is refused", async ({ page }) => {
    await installStyleMock(page, { streets: "403" });
    await gotoRealMap(page);

    await page.getByRole("button", { name: "Map style" }).click();
    await page.getByRole("menuitemradio", { name: "Streets" }).click();

    await expect(
      page.getByText("Streets couldn't load. Showing the standard map.").first(),
    ).toBeVisible();
    await expect.poll(async () => (await debugMap(page))?.styleState).toBe("ready");
    await expect.poll(async () => (await debugMap(page))?.activeStyle).toBe("standard");
    await expect(page.getByTestId("maptiler-logo")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /OpenStreetMap · OpenFreeMap/ })).toBeVisible();

    await page.waitForTimeout(1_000);
    expect((await styleCounts(page)).streets).toBe(1);
    await expectNoAxeViolations(page);
  });
});

test.describe("MapTiler review screenshots", () => {
  test.skip(process.env.REVIEW !== "1", "human review only");

  test("Lagos on Satellite and Streets", async ({ page }) => {
    await installStyleMock(page, {
      geofence: true,
      realStyles: process.env.REVIEW === "1",
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoRealMap(page);

    await page.getByRole("button", { name: "Map style" }).click();
    if ((await page.getByRole("menuitemradio", { name: "Satellite" }).count()) === 0) {
      test.skip(true, "VITE_MAPTILER_API_KEY is not configured");
    }
    await page.getByRole("menuitemradio", { name: "Satellite" }).click();
    await expect.poll(async () => (await debugMap(page))?.activeStyle).toBe("satellite");
    await expect.poll(async () => (await debugMap(page))?.geofenceCount).toBe(1);

    for (const zoom of [12, 15, 17] as const) {
      await page.evaluate(
        (next) =>
          window.__FLEET_TEST_MAP__?.flyTo(
            next === 12 ? [3.78, 7.16] : [3.7966666666666664, 7.203333333333333],
            next,
          ),
        zoom,
      );
      await page.waitForTimeout(250);
      await expect
        .poll(async () => (await debugMap(page))?.viewport?.zoom)
        .toBeCloseTo(zoom, 3);
      await captureForReview(page, `maptiler-satellite-z${zoom}`);
    }

    await page.getByRole("button", { name: "Map style" }).click();
    await page.getByRole("menuitemradio", { name: "Streets" }).click();
    await expect.poll(async () => (await debugMap(page))?.activeStyle).toBe("streets");
    await page.evaluate(() =>
      window.__FLEET_TEST_MAP__?.flyTo([3.7966666666666664, 7.203333333333333], 15),
    );
    await page.waitForTimeout(250);
    await captureForReview(page, "maptiler-streets-z15");
  });
});

import { test as base, expect, type Route } from "@playwright/test";
import { alertsFixture } from "../../src/mocks/fixtures/alerts";
import { alertRulesFixture } from "../../src/mocks/fixtures/alertRules";
import { driversFixture } from "../../src/mocks/fixtures/drivers";
import { geofencesFixture } from "../../src/mocks/fixtures/geofences";
import { tripsFixture } from "../../src/mocks/fixtures/trips";
import {
  reportSummaryFixture,
  systemHealthFixture,
} from "../../src/mocks/fixtures/untyped";
import { vehiclesFixture } from "../../src/mocks/fixtures/vehicles";

export const sessionUser = {
  id: "user-pwa",
  tenant_id: "tenant-demo",
  email: "dispatcher@demo.ftb",
  name: "Demo Dispatcher",
  role: "admin" as const,
};

export interface PwaHarness {
  /** Fail the connectivity probe and every API request when true. */
  offline: boolean;
  apiRequests: Array<{ method: string; path: string }>;
  setOffline: (offline: boolean) => void;
}

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/**
 * Production preview has no MSW. Playwright routes stand in for the API; the
 * service worker handles the shell, the map pack and static assets.
 */
export const test = base.extend<{ pwa: PwaHarness }>({
  pwa: [
    async ({ context, page }, use) => {
    const harness: PwaHarness = {
      offline: false,
      apiRequests: [],
      setOffline: (offline) => {
        harness.offline = offline;
      },
    };

    await context.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace("/api/v1", "");
      harness.apiRequests.push({ method: request.method(), path });

      if (harness.offline) {
        await route.abort("internetdisconnected");
        return;
      }

      if (path === "/me") {
        await json(route, { user: sessionUser, csrf_token: "csrf-pwa-test" });
        return;
      }
      if (path === "/auth/logout") {
        await route.fulfill({ status: 204 });
        return;
      }
      if (path === "/live/snapshot" || path === "/vehicles") {
        await json(route, { data: vehiclesFixture });
        return;
      }
      if (/^\/vehicles\/[^/]+\/events$/.test(path)) {
        await json(route, {
          data: [
            {
              at: vehiclesFixture[0]?.recorded_at ?? new Date().toISOString(),
              kind: "position",
              name: "Ignition on",
              type: "ignition",
            },
          ],
        });
        return;
      }
      if (/^\/vehicles\/[^/]+$/.test(path)) {
        await json(route, { data: vehiclesFixture[0] });
        return;
      }
      if (path === "/alerts") {
        await json(route, { data: alertsFixture });
        return;
      }
      if (path === "/alert-rules") {
        await json(route, { data: alertRulesFixture });
        return;
      }
      if (path === "/trips") {
        await json(route, { data: tripsFixture });
        return;
      }
      if (path === "/drivers") {
        await json(route, { data: driversFixture });
        return;
      }
      if (path === "/geofences") {
        await json(route, { data: geofencesFixture });
        return;
      }
      if (path === "/reports/summary") {
        await json(route, reportSummaryFixture);
        return;
      }
      if (path === "/system/health") {
        await json(route, systemHealthFixture);
        return;
      }
      if (path === "/audit") {
        await json(route, { error: { code: "forbidden", message: "forbidden" } }, 403);
        return;
      }
      await json(route, { error: { code: "not_found", message: "not mocked" } }, 404);
    });

    await page.routeWebSocket(/\/api\/v1\/live\/ws$/, (socket) => {
      socket.onMessage(() => undefined);
    });

    await use(harness);
    },
    { auto: true },
  ],
});

export { expect };

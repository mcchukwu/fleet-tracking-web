import { chromium, type FullConfig, type Page } from "@playwright/test";

/**
 * Compiles and warms the route graphs once before the workers start. With
 * route-level chunks, a first direct load now pays a Vite transform that can
 * exceed a spec's expect timeout; warming removes that cold-start cost from
 * every test without weakening the assertions.
 */
const WARM_ROUTES = [
  "/styleguide",
  "/map?map=fake",
  "/map",
  "/alerts",
  "/trips",
  "/drivers",
  "/geofences",
  "/import",
  "/reports",
  "/system",
  "/audit",
  "/playback",
  "/dev/combobox",
];

async function warmRoute(page: Page, baseURL: string, path: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(`${baseURL}${path}`, { waitUntil: "load", timeout: 180_000 });
      await page
        .locator("[data-page-frame]")
        .first()
        .waitFor({ state: "visible", timeout: 180_000 });
      // Let any Vite dependency re-optimisation reload settle before the
      // workers share this server.
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
      return;
    } catch {
      if (attempt === 1) throw new Error(`Could not warm ${path}`);
    }
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const project = config.projects[0];
  const baseURL = project?.use.baseURL;
  if (!baseURL) return;

  const browser = await chromium.launch(project?.use.launchOptions ?? {});
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.addInitScript(() => {
      try {
        // The mock reads this override; admin can render every warmed route.
        localStorage.setItem("fleet.mockRole", "admin");
      } catch {
        // Storage may be unavailable; the warm-up is best-effort.
      }
    });
    for (const path of WARM_ROUTES) {
      await warmRoute(page, baseURL, path);
    }
  } finally {
    await browser.close();
  }
}

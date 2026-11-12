import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PWA_PORT ?? 4174);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const isCI = Boolean(process.env.CI);
const launchOptions = executablePath
  ? { executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] }
  : {};

/**
 * Production build + preview: the only context where the service worker,
 * Workbox precache and the real PMTiles range route exist.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.pwa\.spec\.ts/,
  fullyParallel: false,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/pwa",
  timeout: 120_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions,
  },
  projects: [
    {
      name: "pwa-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "pwa-chromium-mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    {
      name: "pwa-webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "pwa-webkit-ios",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      VITE_MAP_PMTILES_URL: "/map/test.pmtiles",
      VITE_FLEET_DEBUG: "1",
      VITE_APP_VERSION: "pwa-test",
    },
  },
});

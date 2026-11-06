import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = executablePath
  ? { executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] }
  : {};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results/artifacts",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    ...(["desktop", "mobile"] as const).flatMap((device) =>
      (["light", "dark"] as const).map((theme) => ({
        name: `${device}-${theme}`,
        use: {
          ...devices["Desktop Chrome"],
          viewport:
            device === "mobile"
              ? { width: 390, height: 844 }
              : { width: 1440, height: 900 },
          ...(device === "mobile" ? { hasTouch: true } : {}),
          launchOptions,
        },
      })),
    ),
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_MOCK: "1",
      // Test-only satellite configuration. The fake adapter never fetches these
      // tiles; it proves the style UI, persistence and offline fallback.
      VITE_SATELLITE_TILES_URL: "https://satellite.test/{z}/{x}/{y}.jpg",
      VITE_SATELLITE_ATTRIBUTION: "© Test imagery",
      VITE_SATELLITE_ATTRIBUTION_HREF: "https://example.com/imagery",
    },
  },
});

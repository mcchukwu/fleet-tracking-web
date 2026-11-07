import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const review = process.env.REVIEW === "1";
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
  // The first test in each project boots the whole console and the MSW worker;
  // a 5s default assertion timeout made cold starts look like product failures.
  expect: { timeout: 15_000 },
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
      // Ordinary e2e routes every style and tile request, so no real key or
      // quota is used. `e2e:review` deliberately uses the local key instead so
      // the human sees real MapTiler cartography.
      ...(review
        ? {}
        : {
            VITE_MAPTILER_API_KEY: "test-key",
            VITE_MAP_STYLE_URL_LIGHT: "https://styles.test/standard-light.json",
            VITE_MAP_STYLE_URL_DARK: "https://styles.test/standard-dark.json",
          }),
    },
  },
});

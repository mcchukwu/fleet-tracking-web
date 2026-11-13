import { availableParallelism } from "node:os";
import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const review = process.env.REVIEW === "1";
const isCI = Boolean(process.env.CI);
const localWorkers =
  Number(process.env.PLAYWRIGHT_WORKERS) ||
  Math.max(1, availableParallelism() - 1);
const launchOptions = executablePath
  ? { executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] }
  : {};

export default defineConfig({
  testDir: "./e2e",
  testIgnore: /.*\.pwa\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  ...(isCI ? {} : { workers: localWorkers }),
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results/artifacts",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    ...(["desktop", "mobile"] as const).flatMap((device) =>
      (["light", "dark"] as const).map((theme) => ({
        name: `${device}-${theme}`,
        // The light projects run everything; the dark projects run only the
        // tagged visual and theme set, so @theme tests still run in both themes.
        grep: theme === "dark" ? /@theme/ : undefined,
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
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
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

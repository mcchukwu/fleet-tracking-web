import { chromium, type FullConfig } from "@playwright/test";

/**
 * Compiles and warms the heaviest dev-server routes once before the workers
 * start. Vite's first transform of the map, picker and styleguide graphs can
 * take longer than a spec's timeout; warming removes that cold-start cost from
 * every test without weakening the assertions.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const project = config.projects[0];
  const baseURL = project?.use.baseURL;
  if (!baseURL) return;

  const browser = await chromium.launch(project?.use.launchOptions ?? {});
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    for (const path of ["/map?map=fake", "/alerts", "/dev/combobox", "/styleguide"]) {
      try {
        await page.goto(`${baseURL}${path}`, {
          waitUntil: "load",
          timeout: 180_000,
        });
        await page.locator("[data-page-frame]").waitFor({ state: "visible", timeout: 180_000 });
      } catch {
        continue;
      }
    }
  } finally {
    await browser.close();
  }
}

import { expect, test as base } from "@playwright/test";
import { setStoredTheme, type ReviewTheme } from "./helpers";

export const test = base.extend<{ theme: ReviewTheme }>({
  // oxlint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern.
  theme: async ({}, use, testInfo) => {
    await use(testInfo.project.name.includes("dark") ? "dark" : "light");
  },
  page: async ({ page, theme }, use) => {
    await setStoredTheme(page, theme);
    await use(page);
  },
});

export { expect };

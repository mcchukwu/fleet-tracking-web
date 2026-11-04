import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export type ReviewTheme = "light" | "dark";

export async function setStoredTheme(page: Page, theme: ReviewTheme): Promise<void> {
  await page.addInitScript((value) => {
    try {
      localStorage.setItem("fleet.theme", value);
    } catch {
      // Storage may be unavailable in a hardened browser; the app falls back to system.
    }
  }, theme);
}

export async function expectTheme(page: Page, theme: ReviewTheme): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe(theme);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows, "page has horizontal scroll").toBe(false);
}

export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations,
    results.violations.map((violation) => `${violation.id}: ${violation.help}`).join("\n"),
  ).toEqual([]);
}

export async function expectFocusVisible(locator: Locator): Promise<void> {
  await locator.focus();
  const focus = await locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      boxShadow: style.boxShadow,
    };
  });
  // Inputs use an inset focus ring instead of an outline (design-system §12).
  const hasOutline = focus.outlineStyle !== "none" && focus.outlineWidth > 0;
  const hasRing = focus.boxShadow !== "none" && /[1-9]\d*px/.test(focus.boxShadow);
  expect(hasOutline || hasRing, "focused element has no visible focus indicator").toBe(true);
}

export async function expectTabularNums(locator: Locator): Promise<void> {
  const value = await locator.evaluate(
    (element) => window.getComputedStyle(element).fontVariantNumeric,
  );
  expect(value).toContain("tabular-nums");
}

export async function expectNoOverlap(a: Locator, b: Locator): Promise<void> {
  const first = await a.boundingBox();
  const second = await b.boundingBox();
  expect(first, "first element has no box").not.toBeNull();
  expect(second, "second element has no box").not.toBeNull();
  if (!first || !second) return;
  const overlaps =
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y;
  expect(overlaps, "floating panels overlap").toBe(false);
}

export async function expectTouchTargets(page: Page, minimum = 44): Promise<void> {
  const tooSmall = await page.evaluate((size) => {
    const selector =
      'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((target) => target.width < size || target.height < size);
  }, minimum);
  expect(tooSmall, `touch targets below ${minimum}px`).toEqual([]);
}

export async function captureForReview(page: Page, name: string): Promise<void> {
  if (process.env.REVIEW !== "1") return;
  const theme = await page.evaluate(() => (document.documentElement.classList.contains("dark") ? "dark" : "light"));
  const viewport = page.viewportSize();
  const viewportName = viewport ? `${viewport.width}x${viewport.height}` : "unknown";
  const directory = join(process.cwd(), "test-results", "review");
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: join(directory, `${name}-${theme}-${viewportName}.png`),
    fullPage: false,
  });
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Missing selector ${selector}`);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

function variable(source: string, name: string): string {
  const match = source.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!match?.[1]) throw new Error(`Missing ${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16),
  );
  const linear = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const lightBase = block(":root");
const darkBase = block(".dark");

const themes = [
  { name: "light", base: lightBase, selectors: {
    blue: ":root",
    violet: ':root[data-accent="violet"]',
    fuchsia: ':root[data-accent="fuchsia"]',
    graphite: ':root[data-accent="graphite"]',
  } },
  { name: "dark", base: darkBase, selectors: {
    blue: ".dark",
    violet: '.dark[data-accent="violet"]',
    fuchsia: '.dark[data-accent="fuchsia"]',
    graphite: '.dark[data-accent="graphite"]',
  } },
] as const;

describe("accent palette", () => {
  it("ships exactly four accents and no teal", () => {
    expect(css).not.toMatch(/teal/);
    for (const theme of themes) {
      for (const selector of Object.values(theme.selectors)) block(selector);
    }
  });

  it("uses white text on every accent fill at 4.5:1", () => {
    for (const theme of themes) {
      for (const [accent, selector] of Object.entries(theme.selectors)) {
        const accentColor = variable(block(selector), "--accent");
        const ratio = contrast("#ffffff", accentColor);
        expect(ratio, `${accent} ${theme.name} accent fill`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps accent text at 4.5:1 on the surface", () => {
    for (const theme of themes) {
      const surface = variable(theme.base, "--surface");
      for (const [accent, selector] of Object.entries(theme.selectors)) {
        const foreground = variable(block(selector), "--accent-fg");
        expect(
          contrast(foreground, surface),
          `${accent} ${theme.name} accent text`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps the focus ring at 3:1 against surface and background", () => {
    for (const theme of themes) {
      const surface = variable(theme.base, "--surface");
      const background = variable(theme.base, "--bg");
      for (const [accent, selector] of Object.entries(theme.selectors)) {
        const ring = variable(block(selector), "--focus-ring");
        expect(contrast(ring, surface), `${accent} ${theme.name} ring on surface`).toBeGreaterThanOrEqual(3);
        expect(contrast(ring, background), `${accent} ${theme.name} ring on background`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("defines an accent contrast token in both themes", () => {
    expect(variable(lightBase, "--accent-contrast")).toBe("#ffffff");
    expect(variable(darkBase, "--accent-contrast")).toBe("#ffffff");
  });
});

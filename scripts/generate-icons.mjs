import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ICONS = [
  { file: "public/favicon-32.png", size: 32, background: "transparent", colour: "#000000", markWidth: 0.94 },
  { file: "public/apple-touch-icon.png", size: 180, background: "#09090b", colour: "#ffffff", markWidth: 0.7 },
  { file: "public/icons/icon-192.png", size: 192, background: "#09090b", colour: "#ffffff", markWidth: 0.72 },
  { file: "public/icons/icon-512.png", size: 512, background: "#09090b", colour: "#ffffff", markWidth: 0.72 },
  {
    file: "public/icons/icon-maskable-512.png",
    size: 512,
    background: "#09090b",
    colour: "#ffffff",
    markWidth: 0.6,
  },
];

const source = await readFile(join(process.cwd(), "src/assets/brand/zoro-symbol.svg"), "utf8");
const markup = source
  .replace(/<\?xml[^>]*\?>\s*/, "")
  .trim()
  .replace("<svg ", '<svg fill="currentColor" ');

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  for (const icon of ICONS) {
    const page = await browser.newPage({
      viewport: { width: icon.size, height: icon.size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>
        html, body { margin: 0; width: ${icon.size}px; height: ${icon.size}px; }
        body { display: flex; align-items: center; justify-content: center; background: ${icon.background}; }
        svg { display: block; width: ${Math.round(icon.size * icon.markWidth)}px; height: auto; color: ${icon.colour}; }
      </style>${markup}`,
      { waitUntil: "load" },
    );
    const path = join(process.cwd(), icon.file);
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, omitBackground: icon.background === "transparent" });
    await page.close();
    console.log(`${icon.file} (${icon.size}x${icon.size})`);
  }
} finally {
  await browser.close();
}

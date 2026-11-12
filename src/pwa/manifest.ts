export interface ManifestColors {
  theme: string;
  background: string;
}

export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: "any" | "maskable";
}

export interface WebManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: "standalone";
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
}

/** Reads a custom property from the light `:root` block of tokens.css. */
export function readCssVariable(cssText: string, name: string): string {
  const root = cssText.match(/:root\s*\{([\s\S]*?)\}/);
  if (!root) throw new Error("tokens.css has no :root block");
  const pattern = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^;]+);`);
  const match = root[1].match(pattern);
  if (!match) throw new Error(`Token ${name} is missing from tokens.css`);
  return match[1].trim();
}

export function buildManifest(colors: ManifestColors): WebManifest {
  return {
    name: "Fleet Console",
    short_name: "Fleet",
    description: "Dispatcher and security console for the fleet.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: colors.theme,
    background_color: colors.background,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

export function manifestFromTokens(cssText: string): WebManifest {
  const background = readCssVariable(cssText, "--bg");
  return buildManifest({ theme: background, background });
}

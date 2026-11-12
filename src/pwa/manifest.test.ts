import { describe, expect, it } from "vitest";
import { buildManifest, manifestFromTokens, readCssVariable } from "./manifest";

const tokens = `
:root {
  --bg: #fafafa;
  --surface: #ffffff;
}
.dark {
  --bg: #09090b;
  --surface: #18181b;
}
`;

describe("readCssVariable", () => {
  it("reads a token from the light root block only", () => {
    expect(readCssVariable(tokens, "--bg")).toBe("#fafafa");
    expect(readCssVariable(tokens, "--surface")).toBe("#ffffff");
  });

  it("fails loudly when the token is missing", () => {
    expect(() => readCssVariable(tokens, "--nope")).toThrow("--nope");
  });
});

describe("manifest", () => {
  it("builds the required installable fields from the supplied colours", () => {
    const manifest = buildManifest({ theme: "#fafafa", background: "#fafafa" });

    expect(manifest).toMatchObject({
      name: "Fleet Console",
      short_name: "Fleet",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: "#fafafa",
      background_color: "#fafafa",
    });
    expect(manifest.icons?.map((icon) => icon.src)).toEqual([
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-maskable-512.png",
    ]);
    expect(manifest.icons?.find((icon) => icon.purpose === "maskable")?.sizes).toBe("512x512");
  });

  it("takes the theme and background from the light tokens", () => {
    const manifest = manifestFromTokens(tokens);
    expect(manifest.theme_color).toBe("#fafafa");
    expect(manifest.background_color).toBe("#fafafa");
  });
});

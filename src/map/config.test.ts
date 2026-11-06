import { describe, expect, it } from "vitest";
import { readSatelliteConfig } from "./config";

const valid = {
  VITE_SATELLITE_TILES_URL: "https://tiles.example.com/satellite/{z}/{x}/{y}.jpg",
  VITE_SATELLITE_ATTRIBUTION: "© Example imagery",
  VITE_SATELLITE_ATTRIBUTION_HREF: "https://example.com/licence",
};

describe("readSatelliteConfig", () => {
  it("accepts a raster template with attribution", () => {
    expect(readSatelliteConfig(valid)).toEqual({
      tilesUrl: valid.VITE_SATELLITE_TILES_URL,
      attribution: valid.VITE_SATELLITE_ATTRIBUTION,
      attributionHref: valid.VITE_SATELLITE_ATTRIBUTION_HREF,
    });
  });

  it("omits a missing attribution link", () => {
    const config = readSatelliteConfig({ ...valid, VITE_SATELLITE_ATTRIBUTION_HREF: undefined });
    expect(config?.attributionHref).toBeUndefined();
  });

  it("requires both the tile URL and the attribution", () => {
    expect(readSatelliteConfig({ ...valid, VITE_SATELLITE_ATTRIBUTION: "" })).toBeNull();
    expect(readSatelliteConfig({ ...valid, VITE_SATELLITE_TILES_URL: "  " })).toBeNull();
  });

  it("rejects non-http URLs and templates without tile placeholders", () => {
    expect(
      readSatelliteConfig({ ...valid, VITE_SATELLITE_TILES_URL: "javascript:alert(1)" }),
    ).toBeNull();
    expect(
      readSatelliteConfig({
        ...valid,
        VITE_SATELLITE_TILES_URL: "https://tiles.example.com/satellite.jpg",
      }),
    ).toBeNull();
  });

  it("rejects an attribution link that is not http", () => {
    expect(
      readSatelliteConfig({ ...valid, VITE_SATELLITE_ATTRIBUTION_HREF: "javascript:alert(1)" }),
    ).toBeNull();
  });
});

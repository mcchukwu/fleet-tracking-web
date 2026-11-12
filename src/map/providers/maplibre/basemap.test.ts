import { describe, expect, it } from "vitest";
import { contractTokens } from "../../testing/adapter-contract";
import { basemapFlavor, buildBasemapStyle, BASEMAP_ATTRIBUTION } from "./basemap";

const tokens = contractTokens;

describe("basemap flavor", () => {
  it("takes every colour group from the design tokens", () => {
    const flavor = basemapFlavor(tokens, "light");

    expect(flavor.background).toBe(tokens.basemap.background);
    expect(flavor.earth).toBe(tokens.basemap.earth);
    expect(flavor.water).toBe(tokens.basemap.water);
    expect(flavor.park_a).toBe(tokens.basemap.park);
    expect(flavor.buildings).toBe(tokens.basemap.building);
    expect(flavor.major).toBe(tokens.basemap.road);
    expect(flavor.minor_a).toBe(tokens.basemap.roadMinor);
    expect(flavor.boundaries).toBe(tokens.basemap.boundary);
    expect(flavor.city_label).toBe(tokens.basemap.label);
    expect(flavor.city_label_halo).toBe(tokens.basemap.labelHalo);
  });

  it("uses the self-hosted font stacks", () => {
    const flavor = basemapFlavor(tokens, "light");
    expect(flavor.regular).toBe("Noto Sans Regular");
    expect(flavor.bold).toBe("Noto Sans Medium");
    expect(flavor.italic).toBe("Noto Sans Italic");
  });

  it("keeps the theme's landcover and point-of-interest colours", () => {
    const light = basemapFlavor(tokens, "light");
    const dark = basemapFlavor(tokens, "dark");

    expect(dark.landcover?.forest).not.toBe(light.landcover?.forest);
    expect(dark.pois?.green).not.toBe(light.pois?.green);
  });
});

describe("basemap style", () => {
  it("builds a local PMTiles style with local glyphs and sprites", () => {
    const style = buildBasemapStyle(tokens, "light", "/map/fleet.pmtiles");

    expect(style.glyphs).toBe("/map/fonts/{fontstack}/{range}.pbf");
    expect(style.sprite).toBe("/map/sprites/light");
    expect(style.sources.protomaps).toMatchObject({
      type: "vector",
      url: "pmtiles:///map/fleet.pmtiles",
      attribution: BASEMAP_ATTRIBUTION,
    });
    expect(style.layers.length).toBeGreaterThan(10);
    expect(style.layers.some((layer) => layer.type === "background")).toBe(true);
  });

  it("does not duplicate layers when the style is composed again", () => {
    const first = buildBasemapStyle(tokens, "dark", "/map/fleet.pmtiles");
    const second = buildBasemapStyle(tokens, "dark", "/map/fleet.pmtiles");
    expect(second.layers).toHaveLength(first.layers.length);
  });
});

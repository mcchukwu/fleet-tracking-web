import type { StyleSpecification } from "maplibre-gl";
import { layers, namedFlavor, type Flavor } from "@protomaps/basemaps";
import { mapConfig } from "../../config";
import type { MapTokens } from "../../types";

export const BASEMAP_SOURCE = "protomaps";
export const BASEMAP_ATTRIBUTION = "© OpenStreetMap · Protomaps";
export const BASEMAP_FONTS = {
  regular: "Noto Sans Regular",
  bold: "Noto Sans Medium",
  italic: "Noto Sans Italic",
} as const;

/**
 * Protomaps' flavor is a flat colour map. Start from its shape and replace
 * every visible group with the design tokens, so the adapter holds no hex.
 */
export function basemapFlavor(tokens: MapTokens, theme: "light" | "dark"): Flavor {
  const base = namedFlavor(theme);
  const b = tokens.basemap;
  return {
    ...base,
    background: b.background,
    earth: b.earth,
    water: b.water,
    park_a: b.park,
    park_b: b.park,
    wood_a: b.park,
    wood_b: b.park,
    scrub_a: b.park,
    scrub_b: b.park,
    hospital: b.earth,
    industrial: b.earth,
    school: b.earth,
    pedestrian: b.earth,
    glacier: b.earth,
    sand: b.earth,
    beach: b.earth,
    aerodrome: b.earth,
    runway: b.earth,
    zoo: b.earth,
    military: b.earth,
    buildings: b.building,
    minor_a: b.roadMinor,
    minor_b: b.roadMinor,
    minor_service: b.roadMinor,
    minor_casing: b.roadMinor,
    minor_service_casing: b.roadMinor,
    link: b.roadMinor,
    link_casing: b.roadMinor,
    major: b.road,
    highway: b.road,
    major_casing_early: b.boundary,
    major_casing_late: b.boundary,
    highway_casing_early: b.boundary,
    highway_casing_late: b.boundary,
    other: b.roadMinor,
    pier: b.roadMinor,
    railway: b.boundary,
    boundaries: b.boundary,
    tunnel_other: b.roadMinor,
    tunnel_minor: b.roadMinor,
    tunnel_link: b.roadMinor,
    tunnel_major: b.road,
    tunnel_highway: b.road,
    tunnel_other_casing: b.boundary,
    tunnel_minor_casing: b.boundary,
    tunnel_link_casing: b.boundary,
    tunnel_major_casing: b.boundary,
    tunnel_highway_casing: b.boundary,
    bridges_other: b.roadMinor,
    bridges_minor: b.roadMinor,
    bridges_link: b.roadMinor,
    bridges_major: b.road,
    bridges_highway: b.road,
    bridges_other_casing: b.boundary,
    bridges_minor_casing: b.boundary,
    bridges_link_casing: b.boundary,
    bridges_major_casing: b.boundary,
    bridges_highway_casing: b.boundary,
    roads_label_minor: b.label,
    roads_label_minor_halo: b.labelHalo,
    roads_label_major: b.label,
    roads_label_major_halo: b.labelHalo,
    ocean_label: b.label,
    subplace_label: b.label,
    subplace_label_halo: b.labelHalo,
    city_label: b.label,
    city_label_halo: b.labelHalo,
    state_label: b.label,
    state_label_halo: b.labelHalo,
    country_label: b.label,
    address_label: b.label,
    address_label_halo: b.labelHalo,
    regular: BASEMAP_FONTS.regular,
    bold: BASEMAP_FONTS.bold,
    italic: BASEMAP_FONTS.italic,
  };
}

/** The local standard style: one PMTiles vector source, no network style fetch. */
export function buildBasemapStyle(
  tokens: MapTokens,
  theme: "light" | "dark",
  pmtilesUrl: string,
): StyleSpecification {
  return {
    version: 8,
    name: `fleet-basemap-${theme}`,
    glyphs: mapConfig.localGlyphsUrl,
    sprite: `${mapConfig.localSpriteBaseUrl}/${theme}`,
    sources: {
      [BASEMAP_SOURCE]: {
        type: "vector",
        url: `pmtiles://${pmtilesUrl}`,
        attribution: BASEMAP_ATTRIBUTION,
      },
    },
    layers: layers(BASEMAP_SOURCE, basemapFlavor(tokens, theme), { lang: "en" }),
  } as StyleSpecification;
}

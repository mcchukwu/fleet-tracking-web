import { afterEach, describe, expect, it, vi } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import { mapConfig } from "../../config";
import {
  attributionText,
  isMapTilerStyleId,
  localBaseStyle,
  loadBaseStyle,
  StyleLoadError,
  styleUrlFor,
} from "./style";
import { contractTokens } from "../../testing/adapter-contract";

function style(sources: Record<string, unknown>): StyleSpecification {
  return { version: 8, name: "test", sources, layers: [] } as StyleSpecification;
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function mockFetch(routes: Record<string, unknown>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = requestUrl(input);
      const body = routes[url];
      if (body === undefined) throw new TypeError(`Unexpected fetch: ${url}`);
      const status =
        typeof body === "object" && body !== null && "status" in body
          ? Number((body as { status: unknown }).status)
          : 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => (status < 300 ? body : {}),
      } as Response;
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local basemap", () => {
  it("returns a PMTiles style instead of fetching a hosted style", () => {
    const loaded = localBaseStyle("dark", "/map/fleet.pmtiles", contractTokens);

    expect(loaded.attribution).toEqual(["© OpenStreetMap · Protomaps"]);
    expect(loaded.style.sources.protomaps).toMatchObject({
      url: "pmtiles:///map/fleet.pmtiles",
    });
  });
});

describe("attributionText", () => {
  it("turns the style's linked credit into one plain line", () => {
    expect(
      attributionText(
        '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ' +
          '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
      ),
    ).toBe("© MapTiler © OpenStreetMap contributors");
  });

  it("decodes entities and collapses whitespace", () => {
    expect(attributionText("  &copy;  MapTiler\n&nbsp; &amp;  OSM ")).toBe("© MapTiler & OSM");
  });
});

describe("local basemap", () => {
  it("returns a PMTiles style instead of fetching a hosted style", () => {
    const loaded = localBaseStyle("dark", "/map/fleet.pmtiles", contractTokens);

    expect(loaded.attribution).toEqual(["© OpenStreetMap · Protomaps"]);
    expect(loaded.style.sources.protomaps).toMatchObject({
      url: "pmtiles:///map/fleet.pmtiles",
    });
  });
});

describe("MapTiler styles", () => {
  it("recognises only the hosted style ids", () => {
    expect(isMapTilerStyleId("streets")).toBe(true);
    expect(isMapTilerStyleId("satellite")).toBe(true);
    expect(isMapTilerStyleId("standard")).toBe(false);
  });

  it("resolves the standard style from the standard configuration", () => {
    expect(styleUrlFor("standard", "light", null)).toBe(mapConfig.styleUrls.light);
    expect(styleUrlFor("streets", "light", null)).toBeNull();
  });
});

describe("local basemap", () => {
  it("returns a PMTiles style instead of fetching a hosted style", () => {
    const loaded = localBaseStyle("dark", "/map/fleet.pmtiles", contractTokens);

    expect(loaded.attribution).toEqual(["© OpenStreetMap · Protomaps"]);
    expect(loaded.style.sources.protomaps).toMatchObject({
      url: "pmtiles:///map/fleet.pmtiles",
    });
  });
});

describe("loadBaseStyle", () => {
  it("uses the attribution the style provides", async () => {
    const url = "https://api.maptiler.com/maps/streets-v4/style.json?key=direct-1";
    mockFetch({
      [url]: style({
        credit: {
          type: "vector",
          attribution:
            '<a href="https://www.maptiler.com/copyright/">&copy; MapTiler</a> ' +
            '<a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap contributors</a>',
        },
      }),
    });

    const loaded = await loadBaseStyle("streets", "light", { apiKey: "direct-1" });
    expect(loaded.attribution).toEqual(["© MapTiler © OpenStreetMap contributors"]);
  });

  it("falls back to the source TileJSON credit when the style has none", async () => {
    const styleUrl = "https://api.maptiler.com/maps/hybrid-v4/style.json?key=tile-1";
    const tileUrl = "https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=tile-1";
    mockFetch({
      [styleUrl]: style({ satellite: { type: "raster", url: tileUrl } }),
      [tileUrl]: {
        attribution:
          '<a href="https://www.maptiler.com/copyright/">&copy; MapTiler</a> ' +
          '<a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap contributors</a>',
      },
    });

    const loaded = await loadBaseStyle("satellite", "dark", { apiKey: "tile-1" });
    expect(loaded.attribution).toEqual(["© MapTiler © OpenStreetMap contributors"]);
  });

  it("refuses a hosted style without a credit", async () => {
    const url = "https://api.maptiler.com/maps/hybrid-v4/style.json?key=no-credit";
    mockFetch({
      [url]: style({ satellite: { type: "raster", tiles: ["https://t.example/{z}/{x}/{y}.png"] } }),
    });

    await expect(
      loadBaseStyle("satellite", "light", { apiKey: "no-credit" }),
    ).rejects.toBeInstanceOf(StyleLoadError);
  });

  it("reports the HTTP status so the caller can spot a quota pause", async () => {
    const url = "https://api.maptiler.com/maps/streets-v4/style.json?key=quota-429";
    mockFetch({ [url]: { status: 429 } });

    await expect(loadBaseStyle("streets", "light", { apiKey: "quota-429" })).rejects.toMatchObject({
      status: 429,
    });
  });

  it("keeps the standard style free of hosted attribution", async () => {
    const url = mapConfig.styleUrls.light;
    mockFetch({ [url]: style({}) });

    const loaded = await loadBaseStyle("standard", "light", null);
    expect(loaded.attribution).toEqual([]);
  });
});

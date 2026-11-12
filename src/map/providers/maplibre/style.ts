import type { StyleSpecification } from "maplibre-gl";
import {
  mapConfig,
  mapTilerStyleUrl,
  type MapTilerConfig,
  type MapTilerStyleId,
} from "../../config";
import type { MapStyleId, MapTokens } from "../../types";
import { readMapTokens } from "../../tokens";
import { BASEMAP_ATTRIBUTION, buildBasemapStyle } from "./basemap";

export class StyleLoadError extends Error {
  readonly status: number | null;

  constructor(status: number | null, message = "The map style could not load") {
    super(message);
    this.name = "StyleLoadError";
    this.status = status;
  }
}

export function isMapTilerStyleId(id: MapStyleId): id is MapTilerStyleId {
  return id === "streets" || id === "satellite";
}

/** The standard style keeps its URL; hosted styles resolve to MapTiler v4. */
export function styleUrlFor(
  id: MapStyleId,
  theme: "light" | "dark",
  mapTiler: MapTilerConfig | null,
): string | null {
  if (id === "standard") return mapConfig.styleUrls[theme];
  if (!mapTiler) return null;
  return mapTilerStyleUrl(id, theme, mapTiler);
}

/** Turn the style's HTML credit into the single line the chip renders. */
export function attributionText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&copy;/gi, "©")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceAttributions(style: StyleSpecification): string[] {
  return Object.values(style.sources ?? {})
    .map((source) => (source as { attribution?: unknown }).attribution)
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map(attributionText)
    .filter((value) => value !== "");
}

function remoteSourceUrls(style: StyleSpecification): string[] {
  return Object.values(style.sources ?? {})
    .map((source) => (source as { url?: unknown }).url)
    .filter((value): value is string => typeof value === "string" && value.startsWith("http"));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

const styleCache = new Map<string, Promise<StyleSpecification>>();
const attributionCache = new Map<string, Promise<string | null>>();

function isStyle(value: unknown): value is StyleSpecification {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { version?: unknown }).version === 8 &&
    Array.isArray((value as { layers?: unknown }).layers)
  );
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { credentials: "omit", ...(signal ? { signal } : {}) });
  if (!response.ok) throw new StyleLoadError(response.status);
  try {
    return await response.json();
  } catch {
    throw new StyleLoadError(null);
  }
}

function loadJson(url: string, signal?: AbortSignal): Promise<StyleSpecification> {
  const cached = styleCache.get(url);
  if (cached) return cached;
  const request = fetchJson(url, signal).then((value) => {
    if (!isStyle(value)) throw new StyleLoadError(null);
    return value;
  });
  styleCache.set(url, request);
  request.catch(() => styleCache.delete(url));
  return request;
}

function loadTileJsonAttribution(url: string, signal?: AbortSignal): Promise<string | null> {
  const cached = attributionCache.get(url);
  if (cached) return cached;
  const request = fetchJson(url, signal)
    .then((value) => {
      const attribution = (value as { attribution?: unknown }).attribution;
      return typeof attribution === "string" ? attributionText(attribution) || null : null;
    })
    .catch(() => null);
  attributionCache.set(url, request);
  // A missing or aborted attribution must not poison the next attempt.
  void request.then((value) => {
    if (value === null) attributionCache.delete(url);
  });
  return request;
}

export interface LoadedBaseStyle {
  style: StyleSpecification;
  attribution: readonly string[];
}

/**
 * Fetch the style before the adapter swaps it. The old map stays visible while
 * this runs, so a slow style cannot leave a blank canvas.
 */
/** The configured local pack replaces the hosted standard style entirely. */
export function localBaseStyle(
  theme: "light" | "dark",
  pmtilesUrl: string,
  tokens: MapTokens = readMapTokens(),
): LoadedBaseStyle {
  return {
    style: buildBasemapStyle(tokens, theme, pmtilesUrl),
    attribution: [BASEMAP_ATTRIBUTION],
  };
}

export async function loadBaseStyle(
  id: MapStyleId,
  theme: "light" | "dark",
  mapTiler: MapTilerConfig | null,
  signal?: AbortSignal,
): Promise<LoadedBaseStyle> {
  if (id === "standard" && mapConfig.pmtilesUrl !== "") {
    return localBaseStyle(theme, mapConfig.pmtilesUrl);
  }
  const url = styleUrlFor(id, theme, mapTiler);
  if (!url) throw new StyleLoadError(null);

  const style = await loadJson(url, signal);
  if (!isMapTilerStyleId(id)) return { style, attribution: [] };

  const direct = sourceAttributions(style);
  const fromSources = await Promise.all(
    remoteSourceUrls(style).map((sourceUrl) => loadTileJsonAttribution(sourceUrl, signal)),
  );
  const attribution = unique([
    ...direct,
    ...fromSources.filter((value): value is string => value !== null),
  ]);

  // The credit is a licence term, not decoration: refuse to show a MapTiler
  // style whose attribution we could not obtain.
  if (attribution.length === 0) throw new StyleLoadError(null, "The map style has no credit");

  return { style, attribution };
}

/**
 * A background-only style used when the standard basemap cannot load. Data
 * layers are still installed, so the operational map keeps working.
 */
export function fallbackStyle(theme: "light" | "dark", tokens: MapTokens): StyleSpecification {
  return {
    version: 8,
    name: `fleet-fallback-${theme}`,
    sources: {},
    layers: [
      {
        id: "fleet-fallback-background",
        type: "background",
        paint: { "background-color": tokens.colors.surface },
      },
    ],
  };
}

import { describe, expect, it } from "vitest";
import {
  availableStyles,
  mapTilerMapId,
  mapTilerStyleUrl,
  readMapTilerConfig,
} from "./config";

describe("readMapTilerConfig", () => {
  it("accepts a key", () => {
    expect(readMapTilerConfig({ VITE_MAPTILER_API_KEY: "abc123" })).toEqual({
      apiKey: "abc123",
    });
  });

  it("trims the key", () => {
    expect(readMapTilerConfig({ VITE_MAPTILER_API_KEY: "  abc123  " })).toEqual({
      apiKey: "abc123",
    });
  });

  it("hides the hosted styles without a key", () => {
    expect(readMapTilerConfig({})).toBeNull();
    expect(readMapTilerConfig({ VITE_MAPTILER_API_KEY: "" })).toBeNull();
    expect(readMapTilerConfig({ VITE_MAPTILER_API_KEY: "   " })).toBeNull();
  });
});

describe("availableStyles", () => {
  it("only offers Map without a key", () => {
    expect(availableStyles(null)).toEqual(["standard"]);
  });

  it("offers all three styles with a key", () => {
    expect(availableStyles({ apiKey: "abc123" })).toEqual([
      "standard",
      "streets",
      "satellite",
    ]);
  });
});

describe("MapTiler style URLs", () => {
  const config = { apiKey: "abc123" };

  it("uses the v4 streets family and its dark variant", () => {
    expect(mapTilerMapId("streets", "light")).toBe("streets-v4");
    expect(mapTilerMapId("streets", "dark")).toBe("streets-v4-dark");
    expect(mapTilerMapId("satellite", "light")).toBe("hybrid-v4");
    expect(mapTilerMapId("satellite", "dark")).toBe("hybrid-v4");
  });

  it("builds the style endpoint with the key as query data", () => {
    expect(mapTilerStyleUrl("streets", "light", config)).toBe(
      "https://api.maptiler.com/maps/streets-v4/style.json?key=abc123",
    );
    expect(mapTilerStyleUrl("streets", "dark", config)).toBe(
      "https://api.maptiler.com/maps/streets-v4-dark/style.json?key=abc123",
    );
    expect(mapTilerStyleUrl("satellite", "dark", config)).toBe(
      "https://api.maptiler.com/maps/hybrid-v4/style.json?key=abc123",
    );
  });

  it("encodes a key that contains reserved characters", () => {
    expect(mapTilerStyleUrl("satellite", "light", { apiKey: "a b&c" })).toBe(
      "https://api.maptiler.com/maps/hybrid-v4/style.json?key=a%20b%26c",
    );
  });
});

import { describe, expect, it } from "vitest";
import { geofencesFixture } from "../../../mocks/fixtures/geofences";
import type { LngLat } from "../../../map/types";
import {
  boundsOfGeofences,
  boundsOfRings,
  closeRing,
  exteriorRing,
  geometryEquals,
  ringProblemCopy,
  toPolygon,
  validateRing,
} from "./geometry";

const square: LngLat[] = [
  [3.4, 6.4],
  [3.5, 6.4],
  [3.5, 6.5],
  [3.4, 6.5],
];

const triangle: LngLat[] = [
  [3.4, 6.4],
  [3.5, 6.4],
  [3.45, 6.5],
];

const concave: LngLat[] = [
  [3.4, 6.4],
  [3.5, 6.4],
  [3.45, 6.45],
  [3.5, 6.5],
  [3.4, 6.5],
];

describe("validateRing", () => {
  it("accepts a closed square, a triangle and a concave polygon", () => {
    for (const ring of [square, triangle, concave]) {
      expect(validateRing(closeRing(ring))).toEqual({
        ok: true,
        ring: closeRing(ring),
      });
    }
  });

  it("repairs an unclosed ring", () => {
    const result = validateRing(square);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ring[0]).toEqual(result.ring[result.ring.length - 1]);
      expect(result.ring).toHaveLength(5);
    }
  });

  it("rejects fewer than three distinct vertices", () => {
    const result = validateRing([
      [3.4, 6.4],
      [3.4, 6.4],
      [3.5, 6.4],
      [3.5, 6.4],
      [3.4, 6.4],
    ]);
    expect(result).toEqual({ ok: false, problem: "too_few_points" });
  });

  it("rejects a bow-tie polygon", () => {
    const result = validateRing([
      [3.4, 6.4],
      [3.5, 6.5],
      [3.5, 6.4],
      [3.4, 6.5],
    ]);
    expect(result).toEqual({ ok: false, problem: "self_intersection" });
  });

  it("rejects a collinear ring with no area", () => {
    const result = validateRing([
      [3.4, 6.4],
      [3.45, 6.45],
      [3.5, 6.5],
    ]);
    expect(result).toEqual({ ok: false, problem: "no_area" });
  });

  it("rejects non-finite and out-of-range coordinates", () => {
    for (const ring of [
      [
        [Number.NaN, 6.4],
        [3.5, 6.4],
        [3.5, 6.5],
      ],
      [
        [200, 6.4],
        [3.5, 6.4],
        [3.5, 6.5],
      ],
      [
        [3.4, 96],
        [3.5, 6.4],
        [3.5, 6.5],
      ],
    ]) {
      expect(validateRing(ring)).toEqual({ ok: false, problem: "invalid_coordinate" });
    }
  });
});

describe("toPolygon", () => {
  it("always closes the ring", () => {
    expect(toPolygon(square)).toEqual({
      type: "Polygon",
      coordinates: [closeRing(square)],
    });
  });

  it("round-trips through exteriorRing", () => {
    const polygon = toPolygon(square);
    expect(exteriorRing(polygon)).toEqual(closeRing(square));
  });

  it("returns null for an unusable exterior ring", () => {
    expect(exteriorRing({ type: "Polygon", coordinates: [] })).toBeNull();
  });
});

describe("geometryEquals", () => {
  it("tolerates tiny float noise", () => {
    const noisy = square.map(([lon, lat]) => [lon + 1e-9, lat - 1e-9] as LngLat);
    expect(geometryEquals(toPolygon(square), toPolygon(noisy))).toBe(true);
  });

  it("treats a differently ordered ring as different", () => {
    const reordered = [square[0], square[2], square[1], square[3]] as LngLat[];
    expect(geometryEquals(toPolygon(square), toPolygon(reordered))).toBe(false);
  });

  it("compares the exterior ring even when one is unclosed", () => {
    expect(
      geometryEquals(
        { type: "Polygon", coordinates: [square] },
        { type: "Polygon", coordinates: [closeRing(square)] },
      ),
    ).toBe(true);
  });
});

describe("bounds", () => {
  it("covers every ring", () => {
    expect(
      boundsOfRings([
        [
          [3.4, 6.4],
          [3.5, 6.5],
        ],
        [
          [2.9, 7.1],
          [3.1, 7.3],
        ],
      ]),
    ).toEqual({ west: 2.9, south: 6.4, east: 3.5, north: 7.3 });
  });

  it("returns null when nothing is usable", () => {
    expect(boundsOfRings([])).toBeNull();
    expect(boundsOfGeofences([])).toBeNull();
  });

  it("covers every geofence", () => {
    const bounds = boundsOfGeofences(geofencesFixture);
    expect(bounds).not.toBeNull();
    expect(bounds?.west).toBeLessThan(2.8);
    expect(bounds?.north).toBeGreaterThan(7.9);
  });
});

describe("coordinate order", () => {
  it("reads the staging fixture as [lon, lat]", () => {
    const border = geofencesFixture[0];
    expect(border).toBeDefined();
    const ring = exteriorRing(border?.geometry ?? { type: "Polygon", coordinates: [] });
    expect(ring).not.toBeNull();
    expect(ring?.every(([lon, lat]) => lon < 4 && lat > 7)).toBe(true);
    expect(validateRing(ring ?? []).ok).toBe(true);
  });

  it("fails the same [lon, lat] sanity check when a ring is reversed", () => {
    const border = geofencesFixture[0];
    const ring = border ? (border.geometry.coordinates[0] ?? []) : [];
    const reversed = ring.map(([lon, lat]) => [lat, lon] as LngLat);
    expect(reversed.every(([lon, lat]) => lon < 4 && lat > 7)).toBe(false);
  });
});

describe("ringProblemCopy", () => {
  it("has a precise sentence for every problem", () => {
    for (const problem of [
      "too_few_points",
      "self_intersection",
      "no_area",
      "invalid_coordinate",
    ] as const) {
      expect(ringProblemCopy(problem).length).toBeGreaterThan(0);
    }
    expect(ringProblemCopy("self_intersection")).toBe(
      "The polygon crosses itself. Adjust the points.",
    );
  });
});

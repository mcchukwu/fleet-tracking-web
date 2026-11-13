import { describe, expect, it } from "vitest";
import type { Geofence } from "../api/types";
import { repairRing, toMapGeofences } from "./geofences";

function geofence(overrides: Partial<Geofence> = {}): Geofence {
  return {
    id: "gf-1",
    name: "Lekki Depot",
    kind: "depot",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [3.47, 6.43],
          [3.49, 6.43],
          [3.49, 6.445],
          [3.47, 6.43],
        ],
      ],
    },
    ...overrides,
  };
}

describe("map geofences", () => {
  it("keeps [lon, lat] order and passes a closed ring through", () => {
    const [mapped] = toMapGeofences([geofence()]);
    expect(mapped?.rings[0]?.[0]).toEqual([3.47, 6.43]);
    expect(mapped?.rings[0]?.[0]?.[0]).toBe(3.47);
  });

  it("closes an unclosed ring", () => {
    const ring = repairRing([
      [3.47, 6.43],
      [3.49, 6.43],
      [3.49, 6.445],
    ]);
    expect(ring).toHaveLength(4);
    expect(ring?.[0]).toEqual(ring?.[3]);
  });

  it("rejects a degenerate ring", () => {
    expect(
      repairRing([
        [3.47, 6.43],
        [3.47, 6.43],
        [3.47, 6.43],
      ]),
    ).toBeNull();
    expect(
      repairRing([
        [3.47, 6.43],
        [3.49, 6.43],
      ]),
    ).toBeNull();
    expect(
      repairRing([
        [3.47, "6.43"],
        [3.49, 6.43],
        [3.5, 6.5],
      ]),
    ).toBeNull();
  });

  it("skips a geofence whose only ring is invalid", () => {
    expect(
      toMapGeofences([
        geofence({
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [1, 2],
                [3, 4],
              ],
            ],
          },
        }),
      ]),
    ).toEqual([]);
  });

  it("marks the highlighted geofence", () => {
    const mapped = toMapGeofences([geofence()], "gf-1");
    expect(mapped[0]?.highlighted).toBe(true);
  });

  it("passes the server kind through, including the other fallback", () => {
    const mapped = toMapGeofences([geofence({ kind: "other" })]);
    expect(mapped[0]?.kind).toBe("other");
  });
});

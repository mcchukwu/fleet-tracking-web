import { describe, expect, it } from "vitest";
import type { LngLat } from "../../../map/types";
import { GEOFENCE_FORM_DEFAULT, geofenceFormSchema, toCreateInput, toUpdateInput } from "./form";

const square: LngLat[] = [
  [3.4, 6.4],
  [3.5, 6.4],
  [3.5, 6.5],
  [3.4, 6.5],
];

const initial = {
  name: "Lekki Depot",
  kind: "depot" as const,
  ring: square,
};

describe("geofenceFormSchema", () => {
  it("trims the name and keeps the four kinds", () => {
    expect(geofenceFormSchema.parse({ name: "  Gate  ", kind: "customer" })).toEqual({
      name: "Gate",
      kind: "customer",
    });
  });

  it("requires a non-blank name", () => {
    expect(geofenceFormSchema.safeParse({ name: "   ", kind: "depot" }).success).toBe(false);
    expect(geofenceFormSchema.safeParse({ name: "", kind: "depot" }).success).toBe(false);
  });

  it("rejects an unknown kind with the explicit message", () => {
    const result = geofenceFormSchema.safeParse({ name: "Gate", kind: "solar" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Choose a kind.");
  });

  it("defaults to a depot kind", () => {
    expect(GEOFENCE_FORM_DEFAULT).toEqual({ name: "", kind: "depot" });
  });
});

describe("toCreateInput", () => {
  it("builds a trimmed payload with a closed ring", () => {
    expect(toCreateInput({ name: "  Refinery Gate ", kind: "restricted" }, square)).toEqual({
      name: "Refinery Gate",
      kind: "restricted",
      geometry: {
        type: "Polygon",
        coordinates: [[...square, square[0]]],
      },
    });
  });

  it("never builds a payload from an invalid ring", () => {
    expect(
      toCreateInput({ name: "Bow tie", kind: "other" }, [
        [3.4, 6.4],
        [3.5, 6.5],
        [3.5, 6.4],
        [3.4, 6.5],
      ]),
    ).toBeNull();
  });
});

describe("toUpdateInput", () => {
  it("sends a name-only diff", () => {
    expect(toUpdateInput(initial, { name: "Lekki Gate", kind: "depot" }, square)).toEqual({
      name: "Lekki Gate",
    });
  });

  it("sends a kind-only diff", () => {
    expect(toUpdateInput(initial, { name: "Lekki Depot", kind: "customer" }, square)).toEqual({
      kind: "customer",
    });
  });

  it("sends a geometry-only diff", () => {
    const moved = square.map(([lon, lat]) => [lon + 0.001, lat] as LngLat);
    expect(toUpdateInput(initial, { name: "Lekki Depot", kind: "depot" }, moved)).toEqual({
      geometry: { type: "Polygon", coordinates: [[...moved, moved[0]]] },
    });
  });

  it("sends every changed field", () => {
    const moved = square.map(([lon, lat]) => [lon + 0.001, lat] as LngLat);
    expect(toUpdateInput(initial, { name: "Gate", kind: "other" }, moved)).toEqual({
      name: "Gate",
      kind: "other",
      geometry: { type: "Polygon", coordinates: [[...moved, moved[0]]] },
    });
  });

  it("sends an empty diff when nothing changed", () => {
    expect(toUpdateInput(initial, { name: "Lekki Depot", kind: "depot" }, square)).toEqual({});
  });

  it("returns null when the edited ring is invalid", () => {
    expect(
      toUpdateInput(initial, { name: "Lekki Depot", kind: "depot" }, [
        [3.4, 6.4],
        [3.5, 6.5],
        [3.5, 6.4],
        [3.4, 6.5],
      ]),
    ).toBeNull();
  });
});

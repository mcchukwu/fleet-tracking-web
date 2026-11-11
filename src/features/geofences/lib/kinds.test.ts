import { describe, expect, it } from "vitest";
import {
  GEOFENCE_KIND_LABELS,
  GEOFENCE_KIND_ORDER,
  GEOFENCE_KIND_STROKES,
  geofenceKindInfo,
} from "./kinds";

describe("geofence kinds", () => {
  it("orders and labels every kind", () => {
    expect(GEOFENCE_KIND_ORDER).toEqual(["depot", "customer", "restricted", "other"]);
    expect(GEOFENCE_KIND_LABELS).toEqual({
      depot: "Depot",
      customer: "Customer",
      restricted: "Restricted",
      other: "Other",
    });
  });

  it("describes the stroke pattern for every kind", () => {
    for (const kind of GEOFENCE_KIND_ORDER) {
      expect(GEOFENCE_KIND_STROKES[kind].length).toBeGreaterThan(0);
    }
    expect(GEOFENCE_KIND_STROKES.customer.toLowerCase()).toContain("dotted");
    expect(GEOFENCE_KIND_STROKES.restricted.toLowerCase()).toContain("hatch");
  });

  it("falls back to Other for an unknown kind", () => {
    expect(geofenceKindInfo("solar")).toEqual({
      id: "other",
      label: "Other",
      stroke: GEOFENCE_KIND_STROKES.other,
      swatchClassName: expect.any(String),
    });
  });

  it("keeps a known kind intact", () => {
    expect(geofenceKindInfo("customer")).toMatchObject({ id: "customer", label: "Customer" });
  });
});

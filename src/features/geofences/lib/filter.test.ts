import { describe, expect, it } from "vitest";
import type { Geofence } from "../../../api/types";
import { filterGeofences, sortGeofences } from "./filter";

const rows: Geofence[] = [
  {
    id: "b",
    name: "Lekki Depot",
    kind: "depot",
    geometry: { type: "Polygon", coordinates: [] },
  },
  {
    id: "a",
    name: "Ibadan Customer",
    kind: "customer",
    geometry: { type: "Polygon", coordinates: [] },
  },
  {
    id: "c",
    name: "border",
    kind: "other",
    geometry: { type: "Polygon", coordinates: [] },
  },
  {
    id: "d",
    name: "Ibadan Customer",
    kind: "restricted",
    geometry: { type: "Polygon", coordinates: [] },
  },
];

describe("filterGeofences", () => {
  it("matches names case-insensitively", () => {
    expect(filterGeofences(rows, "LEKKI").map((row) => row.id)).toEqual(["b"]);
  });

  it("trims whitespace around the query", () => {
    expect(filterGeofences(rows, "  ibadan ").map((row) => row.id)).toEqual(["a", "d"]);
  });

  it("returns everything for an empty query", () => {
    expect(filterGeofences(rows, "")).toHaveLength(4);
    expect(filterGeofences(rows, "   ")).toHaveLength(4);
  });

  it("returns nothing when no name matches", () => {
    expect(filterGeofences(rows, "airport")).toEqual([]);
  });
});

describe("sortGeofences", () => {
  it("sorts alphabetically then by id", () => {
    expect(sortGeofences(rows).map((row) => row.id)).toEqual(["c", "a", "d", "b"]);
  });

  it("does not mutate the input", () => {
    const copy = [...rows];
    sortGeofences(rows);
    expect(rows).toEqual(copy);
  });

  it("is stable for rows with the same name and id prefix", () => {
    const first = sortGeofences(rows);
    const second = sortGeofences([...rows].reverse());
    expect(second.map((row) => row.id)).toEqual(first.map((row) => row.id));
  });
});

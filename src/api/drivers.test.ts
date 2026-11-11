import { describe, expect, it } from "vitest";
import { parseDrivers } from "./drivers";

const rows = [
  {
    id: "driver-1",
    name: "Adebayo Okafor",
    phone: "08031000010",
    licence: "LIC-01010",
    status: "active",
    vehicles: 1,
  },
  {
    id: "driver-2",
    name: "Adebayo Okafor",
    phone: "",
    licence: "",
    status: "inactive",
    vehicles: 0,
  },
  {
    id: "driver-3",
    name: "Chinedu Musa",
    phone: "+234 803 100 0001",
    licence: "LIC-01001",
    status: "suspended",
    vehicles: 2,
  },
];

describe("parseDrivers", () => {
  it("keeps every real row, including duplicates and an unknown status", () => {
    const result = parseDrivers({ data: rows });
    expect(result.rejected).toBe(0);
    expect(result.drivers.map((driver) => driver.id)).toEqual(["driver-1", "driver-2", "driver-3"]);
    expect(result.drivers[2]?.status).toBe("suspended");
  });

  it("normalises missing or null phone and licence to empty strings", () => {
    const result = parseDrivers({
      data: [{ id: "driver-4", name: "No Contact", status: "active", vehicles: 0 }],
    });
    expect(result.drivers[0]?.phone).toBe("");
    expect(result.drivers[0]?.licence).toBe("");

    const nulls = parseDrivers({
      data: [
        {
          id: "driver-5",
          name: "Null Contact",
          phone: null,
          licence: null,
          status: "active",
          vehicles: 0,
        },
      ],
    });
    expect(nulls.drivers[0]?.phone).toBe("");
    expect(nulls.drivers[0]?.licence).toBe("");
  });

  it("drops structurally invalid rows and counts them", () => {
    const result = parseDrivers({
      data: [{ id: "missing-vehicles", name: "Invalid", status: "active" }, rows[0]],
    });
    expect(result.drivers).toHaveLength(1);
    expect(result.rejected).toBe(1);
  });

  it("rejects a vehicles count that is not a non-negative integer", () => {
    const result = parseDrivers({
      data: [
        { id: "a", name: "A", status: "active", vehicles: -1 },
        { id: "b", name: "B", status: "active", vehicles: 1.5 },
        rows[0],
      ],
    });
    expect(result.drivers).toHaveLength(1);
    expect(result.rejected).toBe(2);
  });

  it("throws when every row is unusable", () => {
    expect(() => parseDrivers({ data: [{ nope: true }] })).toThrow();
  });

  it("rejects a payload without a data array", () => {
    expect(() => parseDrivers({ rows: [] })).toThrow();
    expect(() => parseDrivers(null)).toThrow();
  });

  it("accepts an empty list", () => {
    expect(parseDrivers({ data: [] })).toEqual({ drivers: [], rejected: 0 });
  });
});

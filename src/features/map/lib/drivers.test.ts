import { describe, expect, it } from "vitest";
import type { Driver } from "../../../api/types";
import { activeDrivers, driverDescription, driverOptionLabel, filterDrivers } from "./drivers";

const drivers: Driver[] = [
  { id: "d1", name: "Adebayo Okafor", phone: "08031000010", licence: "LIC-01010", status: "active", vehicles: 1 },
  { id: "d2", name: "Adebayo Okafor", phone: "08031000000", licence: "LIC-01000", status: "active", vehicles: 1 },
  { id: "d3", name: "Chinedu Musa", phone: "08031000001", licence: "LIC-01001", status: "inactive", vehicles: 0 },
];

describe("drivers", () => {
  it("excludes inactive drivers from assignment", () => {
    expect(activeDrivers(drivers).map((driver) => driver.id)).toEqual(["d1", "d2"]);
  });

  it("searches by name, phone and licence ignoring spaces and hyphens", () => {
    expect(filterDrivers(drivers, "adebayo").map((driver) => driver.id)).toEqual(["d1", "d2"]);
    expect(filterDrivers(drivers, "01000").map((driver) => driver.id)).toEqual(["d2"]);
    expect(filterDrivers(drivers, "lic01001").map((driver) => driver.id)).toEqual(["d3"]);
  });

  it("disambiguates duplicate names with phone and licence", () => {
    expect(driverDescription(drivers[0]!)).toBe("08031000010 · LIC-01010");
    expect(driverOptionLabel(drivers[0]!)).toBe("Adebayo Okafor · 08031000010 · LIC-01010");
  });
});

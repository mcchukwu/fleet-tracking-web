import { describe, expect, it } from "vitest";
import type { Driver } from "../api/types";
import {
  activeDrivers,
  driverDescription,
  driverOptionLabel,
  filterDrivers,
} from "./drivers";

const drivers: Driver[] = [
  {
    id: "driver-1",
    name: "Adebayo Okafor",
    phone: "0803 100 0010",
    licence: "LIC-01010",
    status: "active",
    vehicles: 2,
  },
  {
    id: "driver-2",
    name: "Chinedu Musa",
    phone: "0803 100 0001",
    licence: "LIC-01001",
    status: "inactive",
    vehicles: 0,
  },
];

describe("driver helpers", () => {
  it("keeps only active drivers", () => {
    expect(activeDrivers(drivers).map((driver) => driver.id)).toEqual(["driver-1"]);
  });

  it("searches name, phone and licence ignoring spaces and hyphens", () => {
    expect(filterDrivers(drivers, "adebayo")).toHaveLength(1);
    expect(filterDrivers(drivers, "08031000010")).toHaveLength(1);
    expect(filterDrivers(drivers, "lic01001")).toHaveLength(1);
    expect(filterDrivers(drivers, "nobody")).toHaveLength(0);
  });

  it("describes a driver with phone and licence for disambiguation", () => {
    const driver = drivers[0];
    if (!driver) throw new Error("fixture missing");
    expect(driverDescription(driver)).toBe("0803 100 0010 · LIC-01010");
    expect(driverOptionLabel(driver)).toBe("Adebayo Okafor · 0803 100 0010 · LIC-01010");
  });
});

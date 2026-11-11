import { describe, expect, it } from "vitest";
import type { Driver, SnapshotVehicle } from "../api/types";
import {
  activeDrivers,
  driverDescription,
  driverOptionLabel,
  driverStatusLabel,
  driverStatusLabels,
  driverStatusOptions,
  filterDrivers,
  isDriverStatus,
  sortDrivers,
  vehiclesForDriver,
} from "./drivers";

const drivers: Driver[] = [
  {
    id: "driver-2",
    name: "Chinedu Musa",
    phone: "0803 100 0001",
    licence: "LIC-01001",
    status: "suspended",
    vehicles: 3,
  },
  {
    id: "driver-1",
    name: "Adebayo Okafor",
    phone: "0803 100 0010",
    licence: "LIC-01010",
    status: "active",
    vehicles: 2,
  },
  {
    id: "driver-3",
    name: "Adebayo Okafor",
    phone: "0803 100 0000",
    licence: "LIC-01000",
    status: "inactive",
    vehicles: 0,
  },
];

const snapshot: SnapshotVehicle[] = [
  {
    id: "vehicle-2",
    external_id: "demo-imei-0002",
    plate: "LSD-101-AA",
    depot: "Apapa Depot",
    driver_id: "driver-1",
    online: true,
  },
  {
    id: "vehicle-1",
    external_id: "demo-imei-0001",
    plate: "LSD-100-AA",
    depot: "Lekki Depot",
    driver_id: "driver-1",
    online: true,
  },
  {
    id: "vehicle-3",
    external_id: "demo-imei-0003",
    plate: "LSD-102-AA",
    depot: "Lekki Depot",
    driver_id: "driver-2",
    online: false,
  },
];

describe("driver helpers", () => {
  it("recognises only active and inactive, never prototype keys", () => {
    expect(isDriverStatus("active")).toBe(true);
    expect(isDriverStatus("inactive")).toBe(true);
    expect(isDriverStatus("suspended")).toBe(false);
    expect(isDriverStatus("toString")).toBe(false);
    expect(isDriverStatus("__proto__")).toBe(false);
    expect(isDriverStatus(null)).toBe(false);
  });

  it("labels statuses and keeps an unknown value readable", () => {
    expect(driverStatusLabels).toEqual({ active: "Active", inactive: "Inactive" });
    expect(driverStatusOptions).toEqual(["active", "inactive"]);
    expect(driverStatusLabel("active")).toBe("Active");
    expect(driverStatusLabel("suspended")).toBe("Unknown status: suspended");
  });

  it("keeps only active drivers", () => {
    expect(activeDrivers(drivers).map((driver) => driver.id)).toEqual(["driver-1"]);
  });

  it("searches name, phone and licence ignoring case, spaces and hyphens", () => {
    expect(filterDrivers(drivers, "adebayo")).toHaveLength(2);
    expect(filterDrivers(drivers, "08031000010")).toHaveLength(1);
    expect(filterDrivers(drivers, "lic01001")).toHaveLength(1);
    expect(filterDrivers(drivers, "nobody")).toHaveLength(0);
  });

  it("combines the search with the status filter", () => {
    expect(filterDrivers(drivers, "", "active").map((driver) => driver.id)).toEqual(["driver-1"]);
    expect(filterDrivers(drivers, "adebayo", "inactive").map((driver) => driver.id)).toEqual([
      "driver-3",
    ]);
    expect(filterDrivers(drivers, "", null)).toHaveLength(3);
  });

  it("sorts by name, then phone, then licence", () => {
    expect(sortDrivers(drivers).map((driver) => driver.id)).toEqual([
      "driver-3",
      "driver-1",
      "driver-2",
    ]);
    expect(sortDrivers([...drivers].reverse()).map((driver) => driver.id)).toEqual([
      "driver-3",
      "driver-1",
      "driver-2",
    ]);
  });

  it("derives a driver's vehicles from the snapshot by driver id, sorted by plate", () => {
    expect(vehiclesForDriver(snapshot, "driver-1").map((vehicle) => vehicle.plate)).toEqual([
      "LSD-100-AA",
      "LSD-101-AA",
    ]);
    expect(vehiclesForDriver(snapshot, "driver-3")).toEqual([]);
  });

  it("describes a driver with phone and licence for disambiguation", () => {
    const driver = drivers[1];
    if (!driver) throw new Error("fixture missing");
    expect(driverDescription(driver)).toBe("0803 100 0010 · LIC-01010");
    expect(driverOptionLabel(driver)).toBe("Adebayo Okafor · 0803 100 0010 · LIC-01010");
  });
});

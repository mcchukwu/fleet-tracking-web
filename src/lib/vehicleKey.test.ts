import { describe, expect, it } from "vitest";
import { messageVehicleKey, vehicleKey } from "./vehicleKey";
import type { Vehicle } from "../api/types";

const vehicle: Vehicle = {
  id: "4324a768-9b14-4223-a299-eb8da4d8d309",
  external_id: "demo-imei-0001",
  plate: "LSD-100-AA",
  vehicle_type: "tanker",
  make: "MAN",
  model: "TGS",
  colour: "white",
  status: "active",
  depot: "Lekki Depot",
  department: "operations",
  online: true,
};

describe("vehicleKey", () => {
  it("uses the external id for a vehicle", () => {
    expect(vehicleKey(vehicle)).toBe("demo-imei-0001");
  });

  it("uses the live message vehicle id unchanged", () => {
    expect(messageVehicleKey({ vehicle_id: "demo-imei-0019" })).toBe("demo-imei-0019");
  });

  it("never falls back to the UUID", () => {
    expect(vehicleKey({ ...vehicle, external_id: "" })).not.toBe(vehicle.id);
  });
});

import { describe, expect, it } from "vitest";
import type { Vehicle } from "../../../api/types";
import {
  createVehicleFormSchema,
  diffVehicle,
  toAdministrativeStatus,
  toVehicleFormValues,
  validateVehicleForm,
} from "./vehicleForm";

const vehicle: Vehicle = {
  id: "vehicle-1",
  external_id: "demo-imei-0001",
  plate: "LSD-100-AA",
  vehicle_type: "tanker",
  make: "MAN",
  model: "TGS",
  year: 2021,
  colour: "white",
  status: "active",
  depot: "Lekki Depot",
  department: "operations",
  driver_id: "driver-1",
  driver_name: "Adebayo Okafor",
  driver_phone: "08031000010",
  online: true,
};

describe("vehicle form values", () => {
  it("maps a vehicle into editable strings", () => {
    const values = toVehicleFormValues(vehicle);
    expect(values.year).toBe("2021");
    expect(values.driver_id).toBe("driver-1");
    expect(values.status).toBe("active");
  });

  it("maps an unknown administrative status to an empty choice", () => {
    expect(toAdministrativeStatus("reserved")).toBeNull();
    expect(toVehicleFormValues({ ...vehicle, status: "reserved" }).status).toBe("");
  });
});

describe("diffVehicle", () => {
  it("returns an empty diff for an untouched form", () => {
    expect(diffVehicle(vehicle, toVehicleFormValues(vehicle))).toEqual({});
  });

  it("returns only the changed field, trimmed", () => {
    const values = { ...toVehicleFormValues(vehicle), plate: "  LSD-100-AB  " };
    expect(diffVehicle(vehicle, values)).toEqual({ plate: "LSD-100-AB" });
  });

  it("includes a changed driver, status and device field", () => {
    const values = {
      ...toVehicleFormValues(vehicle),
      driver_id: "driver-2",
      status: "maintenance",
      sim_number: "892340000000001",
    };
    expect(diffVehicle(vehicle, values)).toEqual({
      driver_id: "driver-2",
      status: "maintenance",
      sim_number: "892340000000001",
    });
  });

  it("does not send an empty device field or a cleared year", () => {
    const values = {
      ...toVehicleFormValues(vehicle),
      sim_number: "  ",
      year: "",
      plate: "LSD-100-AB",
    };
    expect(diffVehicle(vehicle, values)).toEqual({ plate: "LSD-100-AB" });
  });

  it("never sends a driver clear", () => {
    const values = { ...toVehicleFormValues(vehicle), driver_id: "" };
    expect(diffVehicle(vehicle, values)).toEqual({});
    expect(validateVehicleForm(vehicle, values)).toContainEqual({
      field: "driver_id",
      message: "A driver can't be unassigned here.",
    });
  });

  it("does not send an unknown administrative status", () => {
    const values = { ...toVehicleFormValues(vehicle), status: "reserved" };
    expect(diffVehicle(vehicle, values)).toEqual({});
  });
});

describe("form validation", () => {
  it("rejects a cleared plate and a year outside the range", () => {
    const values = { ...toVehicleFormValues(vehicle), plate: " ", year: "3000" };
    expect(validateVehicleForm(vehicle, values)).toEqual([
      { field: "plate", message: "Plate is required." },
      { field: "year", message: "Enter a year between 1900 and 2100." },
    ]);
  });

  it("rejects clearing a year the vehicle already has", () => {
    const values = { ...toVehicleFormValues(vehicle), year: "" };
    expect(validateVehicleForm(vehicle, values)).toContainEqual({
      field: "year",
      message: "Year can't be cleared.",
    });
  });

  it("rejects an unknown administrative status", () => {
    const values = { ...toVehicleFormValues(vehicle), status: "" };
    expect(validateVehicleForm(vehicle, values)).toContainEqual({
      field: "status",
      message: "Choose an administrative status.",
    });
  });

  it("builds a schema that returns field errors", () => {
    const result = createVehicleFormSchema(vehicle).safeParse({
      ...toVehicleFormValues(vehicle),
      plate: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["plate"]);
    }
  });
});

import { z } from "zod";
import type { Vehicle, VehicleAdministrativeStatus, VehicleUpdate } from "../../../api/types";

export const administrativeStatuses: readonly VehicleAdministrativeStatus[] = [
  "active",
  "maintenance",
  "inactive",
];

export interface VehicleFormValues {
  plate: string;
  driver_id: string;
  status: string;
  vehicle_type: string;
  make: string;
  model: string;
  year: string;
  colour: string;
  depot: string;
  department: string;
  sim_number: string;
  device_model: string;
  protocol: string;
}

export function toAdministrativeStatus(value: string): VehicleAdministrativeStatus | null {
  return administrativeStatuses.includes(value as VehicleAdministrativeStatus)
    ? (value as VehicleAdministrativeStatus)
    : null;
}

export function toVehicleFormValues(vehicle: Vehicle): VehicleFormValues {
  return {
    plate: vehicle.plate,
    driver_id: vehicle.driver_id ?? "",
    status: toAdministrativeStatus(vehicle.status) ?? "",
    vehicle_type: vehicle.vehicle_type,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year !== undefined ? String(vehicle.year) : "",
    colour: vehicle.colour,
    depot: vehicle.depot,
    department: vehicle.department,
    sim_number: vehicle.sim_number ?? "",
    device_model: vehicle.device_model ?? "",
    protocol: vehicle.protocol ?? "",
  };
}

const trimmed = (value: string): string => value.trim();

const TEXT_FIELDS = [
  "plate",
  "vehicle_type",
  "make",
  "model",
  "colour",
  "depot",
  "department",
] as const;

const DEVICE_FIELDS = ["sim_number", "device_model", "protocol"] as const;

/** The server drops nulls, so the form never clears a driver or a year. */
export function diffVehicle(original: Vehicle, values: VehicleFormValues): VehicleUpdate {
  const diff: VehicleUpdate = {};

  for (const field of TEXT_FIELDS) {
    const next = trimmed(values[field]);
    if (next !== "" && next !== original[field]) diff[field] = next;
  }

  const year = values.year.trim();
  if (year !== "") {
    const parsed = Number(year);
    if (Number.isInteger(parsed) && parsed !== original.year) diff.year = parsed;
  }

  const status = toAdministrativeStatus(values.status);
  if (status && status !== original.status) diff.status = status;

  if (values.driver_id !== "" && values.driver_id !== (original.driver_id ?? "")) {
    diff.driver_id = values.driver_id;
  }

  for (const field of DEVICE_FIELDS) {
    const next = trimmed(values[field]);
    if (next !== "" && next !== (original[field] ?? "")) diff[field] = next;
  }

  return diff;
}

export interface ValidationIssue {
  field: keyof VehicleFormValues;
  message: string;
}

export function validateVehicleForm(
  original: Vehicle,
  values: VehicleFormValues,
): ValidationIssue[] {  const issues: ValidationIssue[] = [];
  if (trimmed(values.plate) === "") {
    issues.push({ field: "plate", message: "Plate is required." });
  }

  const status = toAdministrativeStatus(values.status);
  if (!status) {
    issues.push({
      field: "status",
      message: "Choose an administrative status.",
    });
  }

  const year = values.year.trim();
  if (year === "" && original.year !== undefined) {
    issues.push({ field: "year", message: "Year can't be cleared." });
  } else if (year !== "") {
    const parsed = Number(year);
    if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
      issues.push({ field: "year", message: "Enter a year between 1900 and 2100." });
    }
  }

  if (original.driver_id && values.driver_id === "") {
    issues.push({ field: "driver_id", message: "A driver can't be unassigned here." });
  }

  return issues;
}

const formShape = {
  plate: z.string(),
  driver_id: z.string(),
  status: z.string(),
  vehicle_type: z.string(),
  make: z.string(),
  model: z.string(),
  year: z.string(),
  colour: z.string(),
  depot: z.string(),
  department: z.string(),
  sim_number: z.string(),
  device_model: z.string(),
  protocol: z.string(),
} satisfies Record<keyof VehicleFormValues, z.ZodString>;

export function createVehicleFormSchema(original: Vehicle) {
  return z.object(formShape).superRefine((values, context) => {
    for (const issue of validateVehicleForm(original, values)) {
      context.addIssue({
        code: "custom",
        path: [issue.field],
        message: issue.message,
      });
    }
  });
}

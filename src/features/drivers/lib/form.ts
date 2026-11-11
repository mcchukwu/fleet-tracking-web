import { z } from "zod";
import type { Driver, DriverInput, DriverUpdate } from "../../../api/types";

const PHONE_CHARACTERS = /^[+\d\s]+$/;
const MINIMUM_PHONE_DIGITS = 7;

export const DRIVER_PHONE_ERROR =
  "Enter a phone number with at least seven digits.";

export function phoneDigitCount(value: string): number {
  return value.replace(/\D/g, "").length;
}

/** Lenient on purpose: the server does not validate the format. */
export function isDialablePhone(value: string): boolean {
  const trimmed = value.trim();
  return PHONE_CHARACTERS.test(trimmed) && phoneDigitCount(trimmed) >= MINIMUM_PHONE_DIGITS;
}

const phoneField = z
  .string()
  .trim()
  .refine((value) => value === "" || isDialablePhone(value), DRIVER_PHONE_ERROR);

export const driverCreateFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  phone: phoneField,
  licence: z.string().trim(),
});

export type DriverCreateFormValues = z.infer<typeof driverCreateFormSchema>;

export const driverEditFormSchema = driverCreateFormSchema.extend({
  status: z.string().min(1, "Choose a status."),
});

export type DriverEditFormValues = z.infer<typeof driverEditFormSchema>;

export const emptyDriverCreateForm: DriverCreateFormValues = {
  name: "",
  phone: "",
  licence: "",
};

export const emptyDriverEditForm: DriverEditFormValues = {
  ...emptyDriverCreateForm,
  status: "active",
};

/** Only filled optional fields are sent; blank ones are omitted on create. */
export function toDriverInput(values: DriverCreateFormValues): DriverInput {
  return {
    name: values.name.trim(),
    ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
    ...(values.licence.trim() ? { licence: values.licence.trim() } : {}),
  };
}

export function toDriverEditFormValues(driver: Driver): DriverEditFormValues {
  return {
    name: driver.name,
    phone: driver.phone,
    licence: driver.licence,
    status: driver.status,
  };
}

/**
 * Sends only fields the operator changed. A cleared phone or licence is sent as
 * `""` because the server treats that as an explicit clear; an unchanged form
 * produces an empty diff and never reaches the empty-body `400`.
 */
export function diffDriver(driver: Driver, values: DriverEditFormValues): DriverUpdate {
  const update: DriverUpdate = {};
  const name = values.name.trim();
  const phone = values.phone.trim();
  const licence = values.licence.trim();

  if (name !== driver.name) update.name = name;
  if (phone !== driver.phone) update.phone = phone;
  if (licence !== driver.licence) update.licence = licence;
  if (values.status !== driver.status) {
    update.status = values.status === "inactive" ? "inactive" : "active";
  }
  return update;
}

export function hasChanges(update: DriverUpdate): boolean {
  return Object.keys(update).length > 0;
}

/**
 * Deactivation is allowed by the API and keeps the assignments, so the confirm
 * is a client guard against accidental loss of availability.
 */
export function requiresDeactivationConfirmation(
  driver: Driver,
  update: DriverUpdate,
): boolean {
  return update.status === "inactive" && driver.status !== "inactive" && driver.vehicles > 0;
}

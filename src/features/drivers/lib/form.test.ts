import { describe, expect, it } from "vitest";
import type { Driver } from "../../../api/types";
import {
  DRIVER_PHONE_ERROR,
  diffDriver,
  driverCreateFormSchema,
  driverEditFormSchema,
  hasChanges,
  isDialablePhone,
  requiresDeactivationConfirmation,
  toDriverEditFormValues,
  toDriverInput,
} from "./form";

const driver: Driver = {
  id: "driver-1",
  name: "Adebayo Okafor",
  phone: "08031000010",
  licence: "LIC-01010",
  status: "active",
  vehicles: 2,
};

function editValues(overrides: Partial<ReturnType<typeof toDriverEditFormValues>> = {}) {
  return { ...toDriverEditFormValues(driver), ...overrides };
}

describe("driver form", () => {
  it("requires a name and trims it", () => {
    expect(driverCreateFormSchema.safeParse({ name: "   ", phone: "", licence: "" }).success).toBe(
      false,
    );
    const parsed = driverCreateFormSchema.parse({ name: "  Ada  ", phone: "", licence: "" });
    expect(parsed.name).toBe("Ada");
  });

  it("accepts digits, spaces and a plus sign with at least seven digits", () => {
    expect(isDialablePhone("08031000010")).toBe(true);
    expect(isDialablePhone("+234 803 100 0010")).toBe(true);
    expect(isDialablePhone("0803")).toBe(false);
    expect(isDialablePhone("0803 ABC 0010")).toBe(false);
  });

  it("reports the phone rule on blur validation", () => {
    const parsed = driverCreateFormSchema.safeParse({ name: "Ada", phone: "0803", licence: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(DRIVER_PHONE_ERROR);
    }
  });

  it("accepts an empty phone and any licence text", () => {
    expect(
      driverCreateFormSchema.safeParse({ name: "Ada", phone: "", licence: "anything at all" })
        .success,
    ).toBe(true);
  });

  it("omits blank optional fields on create", () => {
    expect(toDriverInput({ name: "  Ada  ", phone: " ", licence: "" })).toEqual({ name: "Ada" });
    expect(toDriverInput({ name: "Ada", phone: "0803 100 0010", licence: "L-1" })).toEqual({
      name: "Ada",
      phone: "0803 100 0010",
      licence: "L-1",
    });
  });

  it("edits allow any current status so an unknown value is not forced", () => {
    expect(driverEditFormSchema.safeParse(editValues({ status: "suspended" })).success).toBe(true);
  });

  it("sends only changed fields", () => {
    expect(diffDriver(driver, editValues())).toEqual({});
    expect(diffDriver(driver, editValues({ phone: "0803 100 0011" }))).toEqual({
      phone: "0803 100 0011",
    });
    expect(diffDriver(driver, editValues({ name: "  Adebayo Okafor  " }))).toEqual({});
  });

  it("sends an empty string to clear phone or licence", () => {
    expect(diffDriver(driver, editValues({ phone: "" }))).toEqual({ phone: "" });
    expect(diffDriver(driver, editValues({ licence: "" }))).toEqual({ licence: "" });
  });

  it("changes status only when it differs", () => {
    expect(diffDriver(driver, editValues({ status: "inactive" }))).toEqual({ status: "inactive" });
    expect(
      diffDriver({ ...driver, status: "suspended" }, editValues({ status: "suspended" })),
    ).toEqual({});
  });

  it("knows when the diff is empty", () => {
    expect(hasChanges({})).toBe(false);
    expect(hasChanges({ phone: "" })).toBe(true);
  });

  it("asks for confirmation only when deactivating a driver with vehicles", () => {
    expect(requiresDeactivationConfirmation(driver, { status: "inactive" })).toBe(true);
    expect(
      requiresDeactivationConfirmation({ ...driver, vehicles: 0 }, { status: "inactive" }),
    ).toBe(false);
    expect(requiresDeactivationConfirmation(driver, { phone: "" })).toBe(false);
    expect(requiresDeactivationConfirmation(driver, { status: "active" })).toBe(false);
    expect(
      requiresDeactivationConfirmation({ ...driver, status: "inactive" }, { status: "inactive" }),
    ).toBe(false);
  });
});

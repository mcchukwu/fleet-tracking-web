import { describe, expect, it } from "vitest";
import { createTripFormSchema, emptyTripForm, toTripInput } from "./form";

describe("trip create form", () => {
  it("requires a vehicle, origin and destination", () => {
    const result = createTripFormSchema.safeParse(emptyTripForm);
    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = result.error.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["vehicle_id", "origin", "destination"]));
    expect(fields).not.toContain("driver_id");
  });

  it("trims the route and omits a blank driver", () => {
    expect(
      toTripInput({
        vehicle_id: "vehicle-1",
        driver_id: "",
        origin: "  Refinery Gate ",
        destination: " Ibadan Customer  ",
      }),
    ).toEqual({
      vehicle_id: "vehicle-1",
      origin: "Refinery Gate",
      destination: "Ibadan Customer",
    });
  });

  it("never sends status or distance", () => {
    const input = toTripInput({
      vehicle_id: "vehicle-1",
      driver_id: "driver-1",
      origin: "A",
      destination: "B",
    });
    expect(input).not.toHaveProperty("status");
    expect(input).not.toHaveProperty("distance_km");
  });
});

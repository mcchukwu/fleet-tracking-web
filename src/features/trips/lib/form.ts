import { z } from "zod";
import type { TripInput } from "../../../api/types";

export const createTripFormSchema = z.object({
  vehicle_id: z.string().min(1, "Choose a vehicle."),
  driver_id: z.string(),
  origin: z.string().trim().min(1, "Enter an origin."),
  destination: z.string().trim().min(1, "Enter a destination."),
});

export type TripFormValues = z.infer<typeof createTripFormSchema>;

export const emptyTripForm: TripFormValues = {
  vehicle_id: "",
  driver_id: "",
  origin: "",
  destination: "",
};

/** Never sends status or distance: the backend owns both. */
export function toTripInput(values: TripFormValues): TripInput {
  return {
    vehicle_id: values.vehicle_id,
    origin: values.origin.trim(),
    destination: values.destination.trim(),
    ...(values.driver_id ? { driver_id: values.driver_id } : {}),
  };
}

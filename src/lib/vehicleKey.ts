import type { Vehicle } from "../api/types";

export function vehicleKey(vehicle: Pick<Vehicle, "external_id">): string {
  return vehicle.external_id;
}

export function messageVehicleKey(message: { vehicle_id: string }): string {
  return message.vehicle_id;
}

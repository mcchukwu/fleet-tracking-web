import type { Vehicle } from "../../../api/types";
import { MISSING } from "../../../lib/format";
import { CopyButton } from "../../../ui/CopyButton";
import { VehicleField, VehicleSection } from "./VehicleField";

export interface VehicleDetailsSectionProps {
  vehicle?: Vehicle;
}

function present(value: string | number | undefined): string {
  return value === undefined || value === "" ? MISSING : String(value);
}

export function VehicleDetailsSection({ vehicle }: VehicleDetailsSectionProps) {
  return (
    <VehicleSection title="Vehicle details">
      <dl>
        <VehicleField label="IMEI">
          {vehicle?.external_id ? (
            <CopyButton inline value={vehicle.external_id} label="IMEI" className="justify-end" />
          ) : (
            MISSING
          )}
        </VehicleField>
        <VehicleField label="Type">{present(vehicle?.vehicle_type)}</VehicleField>
        <VehicleField label="Make">{present(vehicle?.make)}</VehicleField>
        <VehicleField label="Model">{present(vehicle?.model)}</VehicleField>
        <VehicleField label="Year">{present(vehicle?.year)}</VehicleField>
        <VehicleField label="Colour">{present(vehicle?.colour)}</VehicleField>
        <VehicleField label="Depot">{present(vehicle?.depot)}</VehicleField>
        <VehicleField label="Department">{present(vehicle?.department)}</VehicleField>
        <VehicleField label="Administrative status">
          {vehicle?.status
            ? vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1)
            : MISSING}
        </VehicleField>
        <VehicleField label="SIM number">{present(vehicle?.sim_number)}</VehicleField>
        <VehicleField label="Device model">{present(vehicle?.device_model)}</VehicleField>
        <VehicleField label="Protocol">{present(vehicle?.protocol)}</VehicleField>
      </dl>
      <p className="text-muted mt-2 text-xs">Device fields aren't returned by the API.</p>
    </VehicleSection>
  );
}

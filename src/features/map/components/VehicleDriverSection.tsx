import { MISSING } from "../../../lib/format";
import { VehicleField, VehicleSection } from "./VehicleField";

export interface VehicleDriverSectionProps {
  driverName?: string | null;
  driverPhone?: string | null;
}

export function VehicleDriverSection({ driverName, driverPhone }: VehicleDriverSectionProps) {
  if (!driverName) {
    return (
      <VehicleSection title="Driver">
        <p className="text-muted text-sm">No driver assigned.</p>
        <dl className="mt-2">
          <VehicleField label="Phone">{MISSING}</VehicleField>
        </dl>
      </VehicleSection>
    );
  }

  const dialable = driverPhone?.replace(/[^\d+]/g, "");

  return (
    <VehicleSection title="Driver">
      <dl>
        <VehicleField label="Name">{driverName}</VehicleField>
        <VehicleField label="Phone">
          {driverPhone && dialable ? (
            <a
              href={`tel:${dialable}`}
              className="h-touch text-accent-fg focus-visible:outline-focus-ring inline-flex items-center rounded-sm underline-offset-2 hover:underline focus-visible:outline-2 md:h-auto"
            >
              {driverPhone}
            </a>
          ) : (
            MISSING
          )}
        </VehicleField>
      </dl>
    </VehicleSection>
  );
}

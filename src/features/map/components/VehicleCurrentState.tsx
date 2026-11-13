import type { Vehicle } from "../../../api/types";
import {
  formatCoordinates,
  formatHeading,
  formatSpeed,
  formatClockTime,
  MISSING,
} from "../../../lib/format";
import { Badge, StatusPill } from "../../../ui/Badge";
import { CopyButton } from "../../../ui/CopyButton";
import { Timestamp } from "../../../ui/Timestamp";
import { Tooltip } from "../../../ui/Tooltip";
import type { VehicleRow } from "../lib/filter";
import { LiveValue } from "./LiveValue";
import { VehicleField, VehicleSection } from "./VehicleField";

export interface VehicleCurrentStateProps {
  row: VehicleRow | null;
  vehicle?: Vehicle;
}

const freshnessLabel = {
  fresh: "Live",
  delayed: "Delayed",
  stale: "Stale",
} as const;

export function VehicleCurrentState({ row, vehicle }: VehicleCurrentStateProps) {
  const lat = row?.lat ?? vehicle?.lat ?? null;
  const lon = row?.lon ?? vehicle?.lon ?? null;
  const speedKph = row?.speedKph ?? vehicle?.speed_kph ?? null;
  const headingDeg = row?.headingDeg ?? vehicle?.heading_deg ?? null;
  const recordedAt = row?.recordedAt ?? vehicle?.recorded_at ?? null;
  const online = row?.online ?? vehicle?.online ?? false;
  const freshness = row?.freshness ?? "stale";
  const status = row?.status ?? (online ? "idle" : "offline");
  const speedAt =
    row?.speedReportedAtMs ?? (vehicle?.recorded_at ? Date.parse(vehicle.recorded_at) : null);

  return (
    <VehicleSection title="Current state">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={status} />
        {freshness === "stale" ? (
          <Badge tone="warning">Stale</Badge>
        ) : freshness === "delayed" ? (
          <Badge tone="warning">Delayed</Badge>
        ) : (
          <Badge tone="success">{freshnessLabel[freshness]}</Badge>
        )}
      </div>

      <dl className="mt-2">
        <VehicleField label="Speed">
          <LiveValue value={speedKph}>
            {speedAt !== null ? (
              <Tooltip label={`Reported at ${formatClockTime(speedAt)}`}>
                <span className="tabular-nums">{formatSpeed(speedKph)}</span>
              </Tooltip>
            ) : (
              <span className="tabular-nums">{formatSpeed(speedKph)}</span>
            )}
          </LiveValue>
        </VehicleField>
        <VehicleField label="Heading">
          <LiveValue value={headingDeg}>{formatHeading(headingDeg)}</LiveValue>
        </VehicleField>
        <VehicleField label="Last seen">
          {recordedAt ? <Timestamp iso={recordedAt} /> : MISSING}
        </VehicleField>
        <VehicleField label="Online">{online ? "Yes" : "No"}</VehicleField>
        <VehicleField label="Freshness">{freshnessLabel[freshness]}</VehicleField>
        <VehicleField label="Coordinates">
          {lat === null || lon === null ? (
            "No position reported."
          ) : (
            <LiveValue value={`${lat},${lon}`}>
              <CopyButton
                inline
                value={formatCoordinates(lat, lon)}
                label="Coordinates"
                className="justify-end"
              />
            </LiveValue>
          )}
        </VehicleField>
      </dl>
    </VehicleSection>
  );
}
